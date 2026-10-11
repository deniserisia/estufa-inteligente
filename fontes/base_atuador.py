"""Base dos atuadores: servidor gRPC (AtuadorService) + tudo da FonteBase.

Os atuadores são as fontes controláveis: recebem comandos do Gateway por gRPC,
respondem com o estado (EstadoFonte) e também enviam leituras por UDP.
"""
from concurrent import futures

import grpc

import ambiente
import estufa_pb2 as pb
import estufa_pb2_grpc as pb_grpc
from base import FonteBase
from comum import log


class AtuadorBase(FonteBase):
    CONTROLAVEL = True
    INTERVALO_PADRAO = 10.0
    TEM_LIGA = True            # aceita Ligar/Desligar
    TEM_NIVEL = False          # aceita AjustarNivel
    NOME_NIVEL = "nível"
    CHAVE_AMBIENTE = ""        # bloco no arquivo de ambiente
    NIVEL_PADRAO = 0.0
    LIGADO_PADRAO = True

    def __init__(self, args):
        super().__init__(args)
        self.porta_grpc = args.porta_grpc
        self.nivel = float(args.nivel if args.nivel is not None else self.NIVEL_PADRAO)
        if self.TEM_LIGA:
            self.ligado = self.LIGADO_PADRAO if args.ligado is None else args.ligado == "sim"
        else:
            self.ligado = True
        self._servidor = None
        self.publicar_ambiente()

    @classmethod
    def parser(cls, descricao):
        p = super().parser(descricao)
        p.add_argument("--porta-grpc", type=int, required=True, help="porta do servidor gRPC")
        if cls.TEM_NIVEL:
            p.add_argument("--nivel", type=float, default=None,
                           help=f"{cls.NOME_NIVEL} inicial em %% (padrão {cls.NIVEL_PADRAO:g})")
        else:
            p.set_defaults(nivel=None)
        if cls.TEM_LIGA:
            p.add_argument("--ligado", choices=["sim", "nao"], default=None, help="estado inicial")
        else:
            p.set_defaults(ligado=None)
        return p

    # ------------------------------------------------------------ estado

    def estado(self) -> pb.EstadoFonte:
        return pb.EstadoFonte(ligado=self.ligado, nivel=self.nivel,
                              intervalo_envio_s=self.intervalo, em_falha=self.em_falha)

    def valores_ambiente(self) -> dict:
        """O que este atuador provoca no ambiente simulado."""
        return {}

    def publicar_ambiente(self) -> None:
        if self.CHAVE_AMBIENTE:
            ambiente.gravar(self.estufa, self.CHAVE_AMBIENTE, self.valores_ambiente())

    def aplicar(self, descricao: str) -> pb.EstadoFonte:
        """Chamado depois de cada comando aceito."""
        log(self.id, f"comando gRPC aplicado: {descricao}")
        self.publicar_ambiente()
        self.enviar_leitura()  # o Gateway vê o novo estado na hora
        return self.estado()

    # ------------------------------------------------------------ gRPC

    def iniciar_extras(self) -> None:
        self._servidor = grpc.server(futures.ThreadPoolExecutor(max_workers=4))
        pb_grpc.add_AtuadorServiceServicer_to_server(ServicoAtuador(self), self._servidor)
        if self._servidor.add_insecure_port(f"0.0.0.0:{self.porta_grpc}") == 0:
            raise SystemExit(f"[{self.id}] não consegui abrir a porta gRPC {self.porta_grpc} (já em uso?)")
        self._servidor.start()

    def descricao_extra(self) -> str:
        return f", gRPC na porta {self.porta_grpc}"


class ServicoAtuador(pb_grpc.AtuadorServiceServicer):
    """Implementação do serviço definido no .proto."""

    def __init__(self, atuador: AtuadorBase):
        self.a = atuador

    def _exigir_sem_falha(self, context):
        if self.a.em_falha:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION,
                          f"{self.a.id} está em falha simulada")

    def ObterEstado(self, request, context):
        return self.a.estado()

    def Ligar(self, request, context):
        if not self.a.TEM_LIGA:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"{self.a.id} não tem liga/desliga")
        self._exigir_sem_falha(context)
        with self.a.trava:
            self.a.ligado = True
        return self.a.aplicar("ligar")

    def Desligar(self, request, context):
        if not self.a.TEM_LIGA:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"{self.a.id} não tem liga/desliga")
        self._exigir_sem_falha(context)
        with self.a.trava:
            self.a.ligado = False
        return self.a.aplicar("desligar")

    def AjustarNivel(self, request, context):
        if not self.a.TEM_NIVEL:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"{self.a.id} não tem ajuste de nível")
        self._exigir_sem_falha(context)
        if not 0 <= request.nivel <= 100:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "o nível deve ficar entre 0 e 100")
        with self.a.trava:
            self.a.nivel = request.nivel
        return self.a.aplicar(f"{self.a.NOME_NIVEL} = {request.nivel:g}%")

    def AjustarIntervalo(self, request, context):
        self._exigir_sem_falha(context)
        if not 1 <= request.segundos <= 3600:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "o intervalo deve ficar entre 1 e 3600 s")
        with self.a.trava:
            self.a.intervalo = request.segundos
        return self.a.aplicar(f"intervalo de envio = {request.segundos:g} s")

    def SimularFalha(self, request, context):
        with self.a.trava:
            self.a.em_falha = request.ativar
        if request.ativar:
            log(self.a.id, "FALHA SIMULADA: parei de enviar dados e de atuar no ambiente")
            self.a.publicar_ambiente()
            return self.a.estado()
        log(self.a.id, "falha encerrada: voltando a operar")
        self.a.publicar_ambiente()
        self.a._responder_descoberta()
        self.a.enviar_leitura()
        return self.a.estado()
