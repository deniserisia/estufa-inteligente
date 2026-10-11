"""Recebe anúncios e leituras das fontes pela porta UDP do Gateway (6000)."""
import socket

from google.protobuf.message import DecodeError

import estufa_pb2 as pb
from comum import log


class ReceptorUDP:
    def __init__(self, porta: int, registro, armazenamento, descoberta, ao_anunciar, verboso=False):
        self._porta = porta
        self._registro = registro
        self._armazenamento = armazenamento
        self._descoberta = descoberta
        self._ao_anunciar = ao_anunciar
        self._verboso = verboso
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.bind(("0.0.0.0", porta))

    def executar(self) -> None:
        log("udp", f"recebendo dados das fontes na porta {self._porta}")
        while True:
            dados, origem = self._sock.recvfrom(65535)
            msg = pb.MensagemFonte()
            try:
                msg.ParseFromString(dados)
            except DecodeError:
                log("udp", f"datagrama inválido de {origem[0]} ignorado")
                continue
            tipo = msg.WhichOneof("conteudo")
            if tipo == "anuncio":
                self._ao_anunciar(msg.anuncio, "udp")
            elif tipo == "leitura":
                self._tratar_leitura(msg.leitura)

    def _tratar_leitura(self, leitura: pb.Leitura) -> None:
        conhecida, voltou = self._registro.atualizar_leitura(leitura)
        if not conhecida:
            # ex.: o Gateway reiniciou e a fonte continuou enviando
            self._descoberta.solicitar(f"leitura de fonte desconhecida: {leitura.fonte_id}")
        if voltou:
            log("monitor", f"{leitura.fonte_id} voltou a ONLINE")
        self._armazenamento.salvar_leitura(leitura)
        resumo = ", ".join(f"{m.grandeza}={m.valor:g}{m.unidade}" for m in leitura.medicoes)
        if leitura.alerta:
            self._registro.adicionar_alerta(leitura)
            log("ALERTA", f"{leitura.fonte_id} ({leitura.estufa_id}): {leitura.motivo_alerta} [{resumo}]")
        elif self._verboso:
            log("udp", f"{leitura.fonte_id}: {resumo}")
