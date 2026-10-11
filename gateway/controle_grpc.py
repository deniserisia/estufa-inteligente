"""Cliente gRPC do Gateway: envia comandos para as fontes controláveis."""
import threading

import grpc

import estufa_pb2 as pb
import estufa_pb2_grpc as pb_grpc
from comum import log

TIMEOUT_S = 2.0


class ErroComando(Exception):
    """Comando recusado ou sem resposta; a mensagem vai para o Cliente."""


class Controle:
    def __init__(self, registro, armazenamento):
        self._registro = registro
        self._armazenamento = armazenamento
        self._stubs: dict[tuple[str, int], pb_grpc.AtuadorServiceStub] = {}
        self._trava = threading.Lock()

    def _stub(self, ip: str, porta: int) -> pb_grpc.AtuadorServiceStub:
        chave = (ip, porta)
        with self._trava:
            if chave not in self._stubs:
                # rede local: nunca passar por proxy HTTP configurado no sistema
                canal = grpc.insecure_channel(f"{ip}:{porta}", options=[("grpc.enable_http_proxy", 0)])
                self._stubs[chave] = pb_grpc.AtuadorServiceStub(canal)
            return self._stubs[chave]

    def confirmar_estado(self, fonte_id: str) -> None:
        """Logo após a descoberta: chama ObterEstado para confirmar o canal gRPC."""
        info = self._registro.obter(fonte_id)
        if info is None or not info.controlavel:
            return
        try:
            estado = self._stub(info.ip, info.porta_grpc).ObterEstado(pb.Vazio(), timeout=TIMEOUT_S)
            self._registro.atualizar_estado(fonte_id, estado)
            log("grpc", f"ObterEstado({fonte_id}) OK: ligado={estado.ligado} nivel={estado.nivel:g}"
                        f" intervalo={estado.intervalo_envio_s:g}s")
        except grpc.RpcError as e:
            log("grpc", f"ObterEstado({fonte_id}) falhou: {e.code().name}")

    def executar(self, c: pb.ComandoCliente) -> pb.EstadoFonte:
        try:
            estado = self._executar(c)
        except ErroComando as e:
            self._armazenamento.salvar_comando(c, False, str(e))
            log("grpc", f"{pb.TipoComando.Name(c.tipo)} -> {c.fonte_id} RECUSADO: {e}")
            raise
        self._armazenamento.salvar_comando(c, True)
        return estado

    def _executar(self, c: pb.ComandoCliente) -> pb.EstadoFonte:
        info = self._registro.obter(c.fonte_id)
        if info is None:
            raise ErroComando(f"fonte '{c.fonte_id}' desconhecida")
        if not info.controlavel:
            raise ErroComando(f"{c.fonte_id} não é controlável: sensores só enviam dados por UDP")
        stub = self._stub(info.ip, info.porta_grpc)

        if c.tipo == pb.LIGAR:
            rpc, req, desc = stub.Ligar, pb.Vazio(), "Ligar()"
        elif c.tipo == pb.DESLIGAR:
            rpc, req, desc = stub.Desligar, pb.Vazio(), "Desligar()"
        elif c.tipo == pb.AJUSTAR_NIVEL:
            rpc, req, desc = stub.AjustarNivel, pb.ComandoNivel(nivel=c.valor), f"AjustarNivel({c.valor:g})"
        elif c.tipo == pb.AJUSTAR_INTERVALO:
            rpc, req, desc = (stub.AjustarIntervalo, pb.ComandoIntervalo(segundos=c.valor),
                              f"AjustarIntervalo({c.valor:g})")
        elif c.tipo == pb.SIMULAR_FALHA:
            rpc, req, desc = stub.SimularFalha, pb.ComandoFalha(ativar=True), "SimularFalha(true)"
        elif c.tipo == pb.ENCERRAR_FALHA:
            rpc, req, desc = stub.SimularFalha, pb.ComandoFalha(ativar=False), "SimularFalha(false)"
        else:
            raise ErroComando("tipo de comando desconhecido")

        try:
            estado = rpc(req, timeout=TIMEOUT_S)
        except grpc.RpcError as e:
            codigo = e.code()
            if codigo in (grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.DEADLINE_EXCEEDED):
                if self._registro.marcar_offline(c.fonte_id):
                    log("monitor", f"{c.fonte_id} OFFLINE (não respondeu ao gRPC)")
                raise ErroComando(f"{c.fonte_id} não respondeu ao gRPC ({codigo.name})") from None
            raise ErroComando(e.details() or codigo.name) from None

        self._registro.atualizar_estado(c.fonte_id, estado)
        log("grpc", f"{desc} -> {c.fonte_id} OK: ligado={estado.ligado} nivel={estado.nivel:g}"
                    f" intervalo={estado.intervalo_envio_s:g}s falha={estado.em_falha}")
        return estado
