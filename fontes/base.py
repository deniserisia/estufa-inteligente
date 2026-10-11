"""Base comum de todas as fontes: descoberta por multicast, envio UDP e laço periódico.

Cada fonte concreta (sensor ou atuador) herda de FonteBase e implementa:
- medicoes(): o que vai na Leitura
- passo(): avança a simulação a cada segundo e devolve um motivo de alerta (ou None)
"""
import argparse
import random
import socket
import threading
import time

from google.protobuf.message import DecodeError

import estufa_pb2 as pb
from comum import log, rede

NOMES_TIPO = {
    pb.EXAUSTOR: "Exaustor",
    pb.NEBULIZADOR: "Nebulizador",
    pb.TELA_SOMBREAMENTO: "Tela de sombreamento",
    pb.SENSOR_TEMP_UMIDADE: "Sensor de temperatura e umidade",
    pb.SENSOR_LUMINOSIDADE: "Sensor de luminosidade",
    pb.SENSOR_CO2: "Sensor de CO2",
}


def ruido(desvio: float) -> float:
    return random.gauss(0, desvio)


class FonteBase:
    TIPO = pb.TIPO_DESCONHECIDO
    CONTROLAVEL = False
    INTERVALO_PADRAO = 15.0

    def __init__(self, args: argparse.Namespace):
        self.id: str = args.id
        self.estufa: str = args.estufa
        self.ip: str = args.ip or rede.ip_local()
        self.intervalo: float = args.intervalo or self.INTERVALO_PADRAO
        self.aceleracao: float = args.aceleracao
        self.porta_grpc = 0
        self.ligado = True
        self.em_falha = False
        self.gateway: tuple[str, int] | None = None
        self.trava = threading.RLock()
        self._ultimo_envio = 0.0
        self._ultimo_anuncio = 0.0
        self._udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._mc_tx = rede.socket_multicast_emissor()

    # ------------------------------------------------------------ argumentos

    @classmethod
    def parser(cls, descricao: str) -> argparse.ArgumentParser:
        p = argparse.ArgumentParser(description=descricao)
        p.add_argument("--id", required=True, help="identificador único, ex.: temp-e1")
        p.add_argument("--estufa", required=True, help="ex.: estufa-1")
        p.add_argument("--intervalo", type=float, default=None,
                       help=f"segundos entre envios (padrão {cls.INTERVALO_PADRAO:g})")
        p.add_argument("--ip", default=None, help="IP anunciado (padrão: detectado)")
        p.add_argument("--aceleracao", type=float, default=1.0,
                       help="acelera o relógio do sol (1 = hora real, 60 = 1 min real vira 1 h)")
        return p

    # ------------------------------------------------------------ ganchos

    def estado(self) -> pb.EstadoFonte:
        return pb.EstadoFonte(ligado=self.ligado, intervalo_envio_s=self.intervalo,
                              em_falha=self.em_falha)

    def medicoes(self) -> list[pb.Medicao]:
        raise NotImplementedError

    def passo(self) -> str | None:
        """Chamado a cada 1 s. Devolve o motivo de um alerta imediato, ou None."""
        return None

    def iniciar_extras(self) -> None:
        """Os atuadores sobem o servidor gRPC aqui."""

    def descricao_extra(self) -> str:
        return ""

    # ------------------------------------------------------------ descoberta

    def anuncio(self) -> pb.AnuncioFonte:
        return pb.AnuncioFonte(
            fonte_id=self.id, tipo=self.TIPO, estufa_id=self.estufa, ip=self.ip,
            porta_grpc=self.porta_grpc, controlavel=self.CONTROLAVEL,
            estado_inicial=self.estado(),
        )

    def _anunciar_no_grupo(self) -> None:
        """Usado quando a fonte sobe depois do Gateway: ele ouve o grupo e responde."""
        rede.enviar_multicast(self._mc_tx, pb.MensagemMulticast(anuncio=self.anuncio()))
        self._ultimo_anuncio = time.monotonic()

    def _responder_descoberta(self) -> None:
        # Mesmo em falha simulada a fonte responde à descoberta (com em_falha=true no
        # estado): assim um Gateway reiniciado ainda a conhece e pode encerrar a falha.
        # O que a falha corta são as leituras, por isso o Gateway a marca offline.
        with self.trava:
            gw = self.gateway
        if gw is None:
            return
        self._udp.sendto(pb.MensagemFonte(anuncio=self.anuncio()).SerializeToString(), gw)

    def _escutar_multicast(self) -> None:
        rx = rede.socket_multicast_receptor(timeout=1.0)
        while True:
            try:
                dados, origem = rx.recvfrom(65535)
            except socket.timeout:
                continue
            msg = pb.MensagemMulticast()
            try:
                msg.ParseFromString(dados)
            except DecodeError:
                continue
            if msg.WhichOneof("conteudo") != "requisicao":
                continue  # anúncios de outras fontes não interessam
            req = msg.requisicao
            novo = (req.gateway_ip or origem[0], req.gateway_porta_udp)
            with self.trava:
                mudou = novo != self.gateway
                self.gateway = novo
            if mudou:
                log(self.id, f"Gateway descoberto em {novo[0]}:{novo[1]}; respondendo com anúncio")
            self._responder_descoberta()

    # ------------------------------------------------------------ envio de dados

    def enviar_leitura(self, alerta: bool = False, motivo: str = "") -> None:
        with self.trava:
            gw, falha = self.gateway, self.em_falha
            if gw is None or falha:
                return
            leitura = pb.Leitura(
                fonte_id=self.id, tipo=self.TIPO, estufa_id=self.estufa,
                timestamp_ms=rede.agora_ms(), medicoes=self.medicoes(),
                alerta=alerta, motivo_alerta=motivo, estado=self.estado(),
            )
        self._udp.sendto(pb.MensagemFonte(leitura=leitura).SerializeToString(), gw)
        self._ultimo_envio = time.monotonic()
        if alerta:
            log(self.id, f"ALERTA enviado na hora: {motivo}")

    # ------------------------------------------------------------ execução

    def executar(self) -> None:
        self.iniciar_extras()
        extra = self.descricao_extra()
        log(self.id, f"{NOMES_TIPO.get(self.TIPO, 'Fonte')} da {self.estufa} em {self.ip}"
                     f"{extra}; envio a cada {self.intervalo:g} s")
        threading.Thread(target=self._escutar_multicast, daemon=True).start()
        self._anunciar_no_grupo()
        try:
            while True:
                motivo = self.passo()
                agora = time.monotonic()
                if motivo:
                    self.enviar_leitura(alerta=True, motivo=motivo)
                elif agora - self._ultimo_envio >= self.intervalo:
                    self.enviar_leitura()
                with self.trava:
                    sem_gateway = self.gateway is None
                if sem_gateway and agora - self._ultimo_anuncio >= 10:
                    self._anunciar_no_grupo()  # insiste até um Gateway responder
                time.sleep(1)
        except KeyboardInterrupt:
            log(self.id, "encerrada")
