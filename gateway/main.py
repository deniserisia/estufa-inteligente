"""Gateway da Estufa Inteligente.

Uso (na raiz do projeto):
    python gateway/main.py
    python gateway/main.py --verboso          # mostra cada leitura recebida
    python gateway/main.py --db outro.db
"""
import _caminho  # noqa: F401  (ajusta os imports)

import argparse
import pathlib
import threading
import time

import estufa_pb2 as pb
from armazenamento import Armazenamento
from comum import log, rede
from controle_grpc import Controle
from descoberta import Descoberta
from monitor import Monitor
from receptor_udp import ReceptorUDP
from registro import Registro
from servidor_tcp import Processador, ServidorTCP

NOMES = {
    pb.EXAUSTOR: "exaustor", pb.NEBULIZADOR: "nebulizador", pb.TELA_SOMBREAMENTO: "tela",
    pb.SENSOR_TEMP_UMIDADE: "sensor temp/umidade", pb.SENSOR_LUMINOSIDADE: "sensor de luz",
    pb.SENSOR_CO2: "sensor de CO2",
}


def main() -> None:
    p = argparse.ArgumentParser(description="Gateway da Estufa Inteligente")
    p.add_argument("--db", default=str(pathlib.Path(__file__).resolve().parent / "estufa.db"),
                   help="arquivo SQLite (padrão gateway/estufa.db)")
    p.add_argument("--porta-udp", type=int, default=rede.PORTA_UDP_GATEWAY)
    p.add_argument("--porta-tcp", type=int, default=rede.PORTA_TCP_GATEWAY)
    p.add_argument("--verboso", action="store_true", help="mostra cada leitura recebida")
    args = p.parse_args()

    ip = rede.ip_local()
    registro = Registro()
    armazenamento = Armazenamento(args.db)
    controle = Controle(registro, armazenamento)
    for alerta in reversed(armazenamento.alertas_recentes()):  # mais antigo primeiro
        registro.adicionar_alerta(alerta)

    def ao_anunciar(anuncio: pb.AnuncioFonte, via: str) -> None:
        nova, voltou = registro.registrar(anuncio)
        armazenamento.salvar_fonte(anuncio)
        endereco = f"{anuncio.ip}:{anuncio.porta_grpc}" if anuncio.controlavel else anuncio.ip
        if nova:
            log("descoberta", f"fonte registrada via {via}: {anuncio.fonte_id} "
                              f"({NOMES.get(anuncio.tipo, '?')}, {anuncio.estufa_id}) em {endereco}")
            if anuncio.controlavel:
                threading.Thread(target=controle.confirmar_estado, args=(anuncio.fonte_id,),
                                 daemon=True).start()
        elif voltou:
            log("monitor", f"{anuncio.fonte_id} voltou a ONLINE")

    descoberta = Descoberta(ip, args.porta_udp, ao_anunciar)
    receptor = ReceptorUDP(args.porta_udp, registro, armazenamento, descoberta, ao_anunciar, args.verboso)
    servidor = ServidorTCP(args.porta_tcp, Processador(registro, armazenamento, controle))

    log("gateway", f"iniciado em {ip}; UDP {args.porta_udp}, TCP {args.porta_tcp}, banco {args.db}")
    for alvo in (receptor.executar, descoberta.executar, Monitor(registro).executar, servidor.serve_forever):
        threading.Thread(target=alvo, daemon=True).start()
    time.sleep(0.3)  # deixa o receptor UDP de pé antes de pedir as respostas
    descoberta.enviar_requisicao("Gateway iniciado")
    log("tcp", f"aguardando clientes na porta {args.porta_tcp}")

    try:
        while True:
            time.sleep(30)
            online, total = registro.contagem()
            log("gateway", f"{online} de {total} fontes online")
    except KeyboardInterrupt:
        log("gateway", "encerrando")
        servidor.shutdown()


if __name__ == "__main__":
    main()
