"""Sobe as 6 fontes de cada estufa, cada uma como um processo separado.

Uso (na raiz do projeto):
    python scripts/iniciar_fontes.py                    # estufa-1 e estufa-2
    python scripts/iniciar_fontes.py --estufas 1        # só a estufa-1 (ex.: num computador)
    python scripts/iniciar_fontes.py --quente 2         # estufa-2 com clima quente (provoca alerta)

Ctrl+C encerra todas. Para o vídeo, também dá para abrir cada fonte em um
terminal separado; os comandos exatos aparecem impressos ao iniciar.
"""
import argparse
import pathlib
import subprocess
import sys
import time

RAIZ = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
from comum.preparar import garantir_codigo_gerado  # noqa: E402


def comandos_da_estufa(n: int, quente: bool, aceleracao: float) -> list[list[str]]:
    e = f"estufa-{n}"
    base = 50051 + 3 * (n - 1)   # estufa-1: 50051..50053, estufa-2: 50054..50056
    comum = ["--estufa", e, "--aceleracao", str(aceleracao)]
    temp = ["fontes/sensor_temp_umidade.py", "--id", f"temp-e{n}", *comum]
    if quente:
        temp += ["--cenario", "quente"]
    return [
        ["fontes/exaustor.py", "--id", f"exaustor-e{n}", "--porta-grpc", str(base), *comum],
        ["fontes/nebulizador.py", "--id", f"nebulizador-e{n}", "--porta-grpc", str(base + 1), *comum],
        ["fontes/tela.py", "--id", f"tela-e{n}", "--porta-grpc", str(base + 2), *comum],
        temp,
        ["fontes/sensor_luminosidade.py", "--id", f"luz-e{n}", *comum],
        ["fontes/sensor_co2.py", "--id", f"co2-e{n}", *comum],
    ]


def main() -> None:
    p = argparse.ArgumentParser(description="Sobe as fontes simuladas")
    p.add_argument("--estufas", default="1,2", help="números das estufas, ex.: 1,2")
    p.add_argument("--quente", default="", help="estufas com cenário quente, ex.: 2")
    p.add_argument("--aceleracao", type=float, default=1.0,
                   help="acelera o relógio do sol (1 = hora real)")
    args = p.parse_args()

    garantir_codigo_gerado()  # gera uma vez antes de subir os processos
    estufas = [int(x) for x in args.estufas.split(",") if x.strip()]
    quentes = {int(x) for x in args.quente.split(",") if x.strip()}

    processos = []
    for n in estufas:
        for cmd in comandos_da_estufa(n, n in quentes, args.aceleracao):
            print("python " + " ".join(cmd), flush=True)
            processos.append(subprocess.Popen([sys.executable, *cmd], cwd=RAIZ))
            time.sleep(0.15)
    print(f"\n{len(processos)} fontes iniciadas. Ctrl+C encerra todas.\n", flush=True)

    try:
        avisados = set()
        while any(proc.poll() is None for proc in processos):
            for i, proc in enumerate(processos):
                if proc.poll() is not None and i not in avisados:
                    avisados.add(i)
                    print(f"A fonte '{proc.args[3]}' terminou (código {proc.returncode}).", flush=True)
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for proc in processos:
            if proc.poll() is None:
                proc.terminate()
        for proc in processos:
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == "__main__":
    main()
