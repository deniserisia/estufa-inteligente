"""Descoberta de fontes por multicast UDP.

- Ao iniciar, o Gateway envia ao grupo uma RequisicaoDescoberta com seu IP e porta UDP.
- As fontes respondem por UDP direto ao Gateway (tratado em receptor_udp.py).
- Uma fonte que sobe depois anuncia-se no grupo; o Gateway ouve, registra e
  reenvia a requisição, para a fonte aprender o endereço dele.
"""
import socket
import threading
import time

from google.protobuf.message import DecodeError

import estufa_pb2 as pb
from comum import log, rede

REENVIO_PERIODICO_S = 60


class Descoberta:
    def __init__(self, ip_gateway: str, porta_udp: int, ao_anunciar):
        self._ip = ip_gateway
        self._porta = porta_udp
        self._ao_anunciar = ao_anunciar        # função chamada com cada AnuncioFonte
        self._tx = rede.socket_multicast_emissor()
        self._trava = threading.Lock()
        self._ultimo_envio = 0.0
        self._agendada = False

    def enviar_requisicao(self, motivo: str = "") -> None:
        msg = pb.MensagemMulticast(requisicao=pb.RequisicaoDescoberta(
            gateway_ip=self._ip, gateway_porta_udp=self._porta))
        rede.enviar_multicast(self._tx, msg)
        with self._trava:
            self._ultimo_envio = time.monotonic()
        extra = f" ({motivo})" if motivo else ""
        log("descoberta", f"requisição enviada ao grupo {rede.GRUPO_MULTICAST}:{rede.PORTA_MULTICAST}{extra}")

    def solicitar(self, motivo: str) -> None:
        """Reenvia a requisição, no máximo uma vez a cada 2 s.

        Se uma requisição saiu há pouco, agenda uma nova para o fim da janela,
        assim nenhuma fonte que chegou nesse meio-tempo fica sem resposta.
        """
        with self._trava:
            if self._agendada:
                return
            espera = 2 - (time.monotonic() - self._ultimo_envio)
            if espera > 0:
                self._agendada = True
                threading.Timer(espera, self._enviar_agendada, args=(motivo,)).start()
                return
        self.enviar_requisicao(motivo)

    def _enviar_agendada(self, motivo: str) -> None:
        with self._trava:
            self._agendada = False
        self.enviar_requisicao(motivo)

    def executar(self) -> None:
        rx = rede.socket_multicast_receptor(timeout=1.0)
        while True:
            try:
                dados, _ = rx.recvfrom(65535)
            except socket.timeout:
                with self._trava:
                    atrasado = time.monotonic() - self._ultimo_envio > REENVIO_PERIODICO_S
                if atrasado:
                    self.enviar_requisicao("reenvio periódico")
                continue
            msg = pb.MensagemMulticast()
            try:
                msg.ParseFromString(dados)
            except DecodeError:
                continue
            if msg.WhichOneof("conteudo") == "anuncio":
                self._ao_anunciar(msg.anuncio, "multicast")
                self.solicitar(f"fonte nova no grupo: {msg.anuncio.fonte_id}")
            # requisições (inclusive a nossa, que volta pelo loopback) são ignoradas
