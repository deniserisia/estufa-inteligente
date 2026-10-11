"""Servidor TCP do Gateway (porta 7000): atende o backend Java e a CLI.

Protocolo: cada RequisicaoCliente e cada RespostaGateway vão precedidas de
4 bytes big-endian com o tamanho da mensagem Protobuf.
"""
import socketserver
import traceback

import estufa_pb2 as pb
import consultas
from comum import log, rede
from controle_grpc import ErroComando


class _Atendente(socketserver.BaseRequestHandler):
    def handle(self):
        origem = f"{self.client_address[0]}:{self.client_address[1]}"
        log("tcp", f"cliente conectado: {origem}")
        while True:
            try:
                req = rede.receber_msg(self.request, pb.RequisicaoCliente)
            except (ConnectionError, OSError):
                break
            except Exception as e:  # mensagem corrompida
                log("tcp", f"mensagem inválida de {origem}: {e}")
                break
            resposta = self.server.gateway.processar(req)
            try:
                rede.enviar_msg(self.request, resposta)
            except OSError:
                break
        log("tcp", f"cliente desconectado: {origem}")


class ServidorTCP(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, porta: int, gateway):
        self.gateway = gateway
        super().__init__(("0.0.0.0", porta), _Atendente)


class Processador:
    """Traduz cada RequisicaoCliente em uma RespostaGateway."""

    def __init__(self, registro, armazenamento, controle):
        self._registro = registro
        self._armazenamento = armazenamento
        self._controle = controle

    def processar(self, req: pb.RequisicaoCliente) -> pb.RespostaGateway:
        resp = pb.RespostaGateway(request_id=req.request_id, sucesso=True)
        corpo = req.WhichOneof("corpo")
        try:
            if corpo == "listar_fontes":
                resp.fontes.extend(self._registro.listar())
            elif corpo == "comando":
                resp.estado_atualizado.CopyFrom(self._controle.executar(req.comando))
            elif corpo == "consulta":
                c = req.consulta
                log("tcp", f"consulta {pb.TipoConsulta.Name(c.tipo)} janela={c.janela_s or 3600}s"
                           f"{' estufa=' + c.estufa_id if c.estufa_id else ''}")
                resp.resultados.extend(consultas.executar(self._armazenamento, c))
            elif corpo == "historico":
                resp.serie.extend(self._armazenamento.historico(req.historico))
            elif corpo == "listar_alertas":
                resp.alertas.extend(self._registro.alertas())
            else:
                raise ValueError("requisição vazia")
        except (ErroComando, ValueError) as e:
            resp.sucesso = False
            resp.erro = str(e)
        except Exception as e:
            traceback.print_exc()
            resp.sucesso = False
            resp.erro = f"erro interno no Gateway: {e}"
        return resp
