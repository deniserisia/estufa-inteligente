"""Cliente de linha de comando: conecta ao Gateway por TCP e troca mensagens Protobuf.

Modo menu (interativo):
    python cli/cliente.py

Modo direto (bom para testes e para o vídeo):
    python cli/cliente.py listar
    python cli/cliente.py comando exaustor-e1 AJUSTAR_NIVEL 80
    python cli/cliente.py comando nebulizador-e2 LIGAR
    python cli/cliente.py consulta tempo --janela 3600 --limite 30
    python cli/cliente.py consulta umidade --janela 86400
    python cli/cliente.py consulta luz
    python cli/cliente.py historico estufa-1 temperatura --minutos 15
    python cli/cliente.py alertas

Use --host para um Gateway em outra máquina.
"""
import _caminho  # noqa: F401  (ajusta os imports)

import argparse
import socket
import sys
import time
import uuid

import estufa_pb2 as pb
from comum import rede

NOMES_TIPO = {
    pb.EXAUSTOR: "Exaustor", pb.NEBULIZADOR: "Nebulizador", pb.TELA_SOMBREAMENTO: "Tela",
    pb.SENSOR_TEMP_UMIDADE: "Temp/umidade", pb.SENSOR_LUMINOSIDADE: "Luminosidade",
    pb.SENSOR_CO2: "CO2",
}
UNIDADES = {"C": "°C"}
CONSULTAS = {
    "tempo": pb.TEMPO_ACIMA_IDEAL,
    "umidade": pb.MEDIA_UMIDADE_POR_ESTUFA,
    "luz": pb.PICO_LUMINOSIDADE,
}


class ClienteGateway:
    def __init__(self, host: str, porta: int):
        self.sock = socket.create_connection((host, porta), timeout=5)

    def enviar(self, **corpo) -> pb.RespostaGateway:
        req = pb.RequisicaoCliente(request_id=uuid.uuid4().hex[:8], **corpo)
        rede.enviar_msg(self.sock, req)
        resp = rede.receber_msg(self.sock, pb.RespostaGateway)
        if not resp.sucesso:
            raise RuntimeError(resp.erro)
        return resp

    # ------------------------------------------------------------ operações

    def listar(self) -> None:
        resp = self.enviar(listar_fontes=pb.Vazio())
        if not resp.fontes:
            print("Nenhuma fonte descoberta ainda.")
            return
        print(f"{'FONTE':<16}{'TIPO':<14}{'ESTUFA':<10}{'ENDEREÇO':<22}{'STATUS':<9}ESTADO / LEITURA")
        for f in resp.fontes:
            i, e = f.info, f.estado
            end = f"{i.ip}:{i.porta_grpc}" if i.controlavel else i.ip
            status = "online" if f.online else "OFFLINE"
            if i.controlavel:
                partes = []
                if i.tipo != pb.TELA_SOMBREAMENTO:
                    partes.append("ligado" if e.ligado else "desligado")
                if i.tipo in (pb.EXAUSTOR, pb.TELA_SOMBREAMENTO):
                    partes.append(f"nível {e.nivel:g}%")
                partes.append(f"a cada {e.intervalo_envio_s:g}s")
                if e.em_falha:
                    partes.append("EM FALHA")
                detalhe = ", ".join(partes)
            else:
                detalhe = ", ".join(f"{m.grandeza} {m.valor:g} {UNIDADES.get(m.unidade, m.unidade)}"
                                    for m in f.ultimas_medicoes) or "-"
            print(f"{i.fonte_id:<16}{NOMES_TIPO.get(i.tipo, '?'):<14}{i.estufa_id:<10}{end:<22}{status:<9}{detalhe}")

    def comando(self, fonte_id: str, tipo: str, valor: float = 0.0) -> None:
        cmd = pb.ComandoCliente(fonte_id=fonte_id, tipo=pb.TipoComando.Value(tipo.upper()), valor=valor)
        e = self.enviar(comando=cmd).estado_atualizado
        print(f"OK. Estado de {fonte_id}: ligado={e.ligado} nível={e.nivel:g}% "
              f"intervalo={e.intervalo_envio_s:g}s em_falha={e.em_falha}")

    def consulta(self, nome: str, janela: int, limite: float, estufa: str = "") -> None:
        c = pb.ConsultaAgregada(tipo=CONSULTAS[nome], janela_s=janela, limite=limite, estufa_id=estufa)
        resp = self.enviar(consulta=c)
        titulos = {"tempo": f"Tempo acima de {limite:g} °C", "umidade": "Média de umidade",
                   "luz": "Pico de luminosidade"}
        print(f"{titulos[nome]} (janela de {janela // 60} min)")
        if not resp.resultados:
            print("  sem dados nessa janela")
        for r in resp.resultados:
            if nome == "tempo":
                valor = f"{int(r.valor // 60)} min {int(r.valor % 60)} s"
            elif nome == "umidade":
                valor = f"{r.valor:.1f}%"
            else:
                valor = f"{r.valor:,.0f} lux às {time.strftime('%H:%M:%S', time.localtime(r.timestamp_ms / 1000))}"
            print(f"  {r.estufa_id:<10} {valor}   ({r.amostras} leituras)")

    def historico(self, estufa: str, grandeza: str, minutos: int) -> None:
        agora = rede.agora_ms()
        h = pb.ConsultaHistorico(estufa_id=estufa, grandeza=grandeza, de_ms=agora - minutos * 60_000,
                                 ate_ms=agora, max_pontos=40)
        resp = self.enviar(historico=h)
        print(f"{grandeza} em {estufa}, últimos {minutos} min ({len(resp.serie)} pontos)")
        for p in resp.serie:
            marca = "  <- alerta" if p.alerta else ""
            print(f"  {time.strftime('%H:%M:%S', time.localtime(p.timestamp_ms / 1000))}  {p.valor:9.2f}  {p.fonte_id}{marca}")

    def alertas(self) -> None:
        resp = self.enviar(listar_alertas=pb.Vazio())
        if not resp.alertas:
            print("Nenhum alerta.")
        for a in resp.alertas:
            hora = time.strftime("%H:%M:%S", time.localtime(a.timestamp_ms / 1000))
            print(f"  {hora}  {a.estufa_id:<10} {a.fonte_id:<16} {a.motivo_alerta}")


# ---------------------------------------------------------------- menu

def menu(cli: ClienteGateway) -> None:
    opcoes = """
=========== Estufa Inteligente ===========
 1  Listar fontes e estados
 2  Enviar comando a uma fonte
 3  Consulta: tempo acima da temperatura ideal
 4  Consulta: média de umidade por estufa
 5  Consulta: pico de luminosidade
 6  Histórico de uma grandeza
 7  Alertas recentes
 0  Sair"""
    while True:
        print(opcoes)
        op = input("Opção: ").strip()
        try:
            if op == "1":
                cli.listar()
            elif op == "2":
                fonte = input("Fonte (ex.: exaustor-e1): ").strip()
                print("Comandos: LIGAR, DESLIGAR, AJUSTAR_NIVEL, AJUSTAR_INTERVALO, SIMULAR_FALHA, ENCERRAR_FALHA")
                tipo = input("Comando: ").strip().upper()
                valor = 0.0
                if tipo in ("AJUSTAR_NIVEL", "AJUSTAR_INTERVALO"):
                    valor = float(input("Valor (% ou segundos): ").replace(",", "."))
                cli.comando(fonte, tipo, valor)
            elif op in ("3", "4", "5"):
                nome = {"3": "tempo", "4": "umidade", "5": "luz"}[op]
                janela = 86400 if input("Janela: [1] última hora  [2] últimas 24 h: ").strip() == "2" else 3600
                limite = 30.0
                if nome == "tempo":
                    texto = input("Temperatura ideal máxima em °C [30]: ").strip()
                    limite = float(texto.replace(",", ".")) if texto else 30.0
                cli.consulta(nome, janela, limite)
            elif op == "6":
                estufa = input("Estufa (ex.: estufa-1): ").strip()
                grandeza = input("Grandeza (temperatura, umidade, luminosidade, co2): ").strip()
                cli.historico(estufa, grandeza, 15)
            elif op == "7":
                cli.alertas()
            elif op == "0":
                return
        except (RuntimeError, ValueError) as e:
            print(f"Erro: {e}")


def main() -> None:
    p = argparse.ArgumentParser(description="Cliente CLI do Gateway (TCP + Protobuf)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--porta", type=int, default=rede.PORTA_TCP_GATEWAY)
    sub = p.add_subparsers(dest="acao")
    sub.add_parser("listar")
    c = sub.add_parser("comando")
    c.add_argument("fonte")
    c.add_argument("tipo", help="LIGAR, DESLIGAR, AJUSTAR_NIVEL, AJUSTAR_INTERVALO, SIMULAR_FALHA, ENCERRAR_FALHA")
    c.add_argument("valor", type=float, nargs="?", default=0.0)
    q = sub.add_parser("consulta")
    q.add_argument("nome", choices=sorted(CONSULTAS))
    q.add_argument("--janela", type=int, default=3600, help="segundos (3600 = 1 h)")
    q.add_argument("--limite", type=float, default=30.0)
    q.add_argument("--estufa", default="")
    h = sub.add_parser("historico")
    h.add_argument("estufa")
    h.add_argument("grandeza")
    h.add_argument("--minutos", type=int, default=15)
    sub.add_parser("alertas")
    args = p.parse_args()

    try:
        cli = ClienteGateway(args.host, args.porta)
    except OSError as e:
        sys.exit(f"Não consegui conectar ao Gateway em {args.host}:{args.porta} ({e}). Ele está rodando?")

    try:
        if args.acao is None:
            menu(cli)
        elif args.acao == "listar":
            cli.listar()
        elif args.acao == "comando":
            cli.comando(args.fonte, args.tipo, args.valor)
        elif args.acao == "consulta":
            cli.consulta(args.nome, args.janela, args.limite, args.estufa)
        elif args.acao == "historico":
            cli.historico(args.estufa, args.grandeza, args.minutos)
        elif args.acao == "alertas":
            cli.alertas()
    except RuntimeError as e:
        sys.exit(f"Erro do Gateway: {e}")
    except (KeyboardInterrupt, EOFError):
        print()


if __name__ == "__main__":
    main()
