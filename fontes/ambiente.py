"""Simulação física de uma estufa.

ATENÇÃO: isto NÃO faz parte do protocolo distribuído. É só a forma de os
processos de uma mesma estufa (na mesma máquina) compartilharem o "mundo
físico": os atuadores gravam seu estado em ambiente/<estufa>.json e os
sensores leem esse arquivo para calcular temperatura, umidade, luz e CO2.
"""
import json
import math
import os
import pathlib
import time

RAIZ = pathlib.Path(__file__).resolve().parents[1]
PASTA = RAIZ / "ambiente"

PADRAO = {
    "exaustor": {"ativo": False, "nivel": 0.0},
    "nebulizador": {"ativo": False},
    "tela": {"abertura": 50.0},
}


def _arquivo(estufa: str) -> pathlib.Path:
    return PASTA / f"{estufa}.json"


def ler(estufa: str) -> dict:
    """Estado atual dos atuadores da estufa (com valores padrão)."""
    dados = json.loads(json.dumps(PADRAO))
    try:
        with open(_arquivo(estufa), encoding="utf-8") as f:
            salvo = json.load(f)
        for chave, valor in salvo.items():
            if chave in dados and isinstance(valor, dict):
                dados[chave].update(valor)
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return dados


def gravar(estufa: str, atuador: str, valores: dict) -> None:
    """Atualiza o bloco de um atuador. Escrita atômica (arquivo temporário + replace)."""
    PASTA.mkdir(exist_ok=True)
    dados = ler(estufa)
    dados[atuador] = {**dados.get(atuador, {}), **valores}
    tmp = _arquivo(estufa).with_suffix(f".{os.getpid()}.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dados, f)
    for _ in range(5):  # no Windows o replace pode falhar se outro processo estiver lendo
        try:
            os.replace(tmp, _arquivo(estufa))
            return
        except PermissionError:
            time.sleep(0.05)


# ---------------------------------------------------------------- modelo

def hora_simulada(aceleracao: float = 1.0) -> float:
    """Hora do dia (0 a 24). Com aceleracao=1 é a hora local real.

    O cálculo parte do relógio absoluto, então processos com a mesma
    aceleração concordam sobre a hora sem precisar conversar.
    """
    agora = time.time()
    deslocamento = -time.timezone if time.localtime().tm_isdst == 0 else -time.altzone
    segundos_dia = ((agora + deslocamento) * aceleracao) % 86400
    return segundos_dia / 3600


def luz_externa(h: float) -> float:
    return max(0.0, 80000 * math.sin(math.pi * (h - 6) / 12))


def temperatura_externa(h: float) -> float:
    return 26 + 6 * math.sin(math.pi * (h - 9) / 12)


def luz_interna(amb: dict, h: float) -> float:
    abertura = float(amb["tela"]["abertura"])
    return luz_externa(h) * (0.3 + 0.7 * abertura / 100)


def velocidade_exaustor(amb: dict) -> float:
    ex = amb["exaustor"]
    return float(ex["nivel"]) if ex["ativo"] else 0.0


def temperatura_alvo(amb: dict, h: float, extra: float = 0.0) -> float:
    alvo = temperatura_externa(h) + 12 * luz_interna(amb, h) / 80000
    alvo -= 0.08 * velocidade_exaustor(amb)
    if amb["nebulizador"]["ativo"]:
        alvo -= 5
    return alvo + extra


def umidade_alvo(amb: dict, temperatura: float) -> float:
    alvo = 70 - 1.5 * (temperatura - 25) - 0.1 * velocidade_exaustor(amb)
    if amb["nebulizador"]["ativo"]:
        alvo += 20
    return min(95.0, max(20.0, alvo))


def co2_alvo(amb: dict, h: float) -> float:
    alvo = 900 - 5 * velocidade_exaustor(amb) - 0.004 * luz_interna(amb, h)
    return min(1500.0, max(350.0, alvo))
