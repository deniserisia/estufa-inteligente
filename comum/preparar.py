"""Confere as bibliotecas e gera o código Python do .proto quando ele falta ou está velho."""
import importlib
import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[1]
PROTO = RAIZ / "proto" / "estufa.proto"
GEN = RAIZ / "gen"
GERADOS = [GEN / "estufa_pb2.py", GEN / "estufa_pb2_grpc.py"]


def conferir_bibliotecas() -> None:
    """Sai com uma mensagem clara se grpcio, grpcio-tools ou protobuf faltarem."""
    faltando = []
    for modulo in ("grpc", "grpc_tools", "google.protobuf"):
        try:
            importlib.import_module(modulo)
        except ImportError:
            faltando.append(modulo)
    if faltando:
        requisitos = RAIZ / "requirements.txt"
        sys.exit(
            "\nFaltam bibliotecas neste Python: " + ", ".join(faltando) + "\n"
            f"Python usado: {sys.executable}\n\n"
            "Instale NESTE Python com o comando abaixo e rode de novo:\n"
            f'  "{sys.executable}" -m pip install -r "{requisitos}"\n'
        )


def garantir_codigo_gerado() -> None:
    conferir_bibliotecas()
    desatualizado = any(
        not g.exists() or g.stat().st_mtime < PROTO.stat().st_mtime for g in GERADOS
    )
    if desatualizado:
        print("Gerando código Python a partir de proto/estufa.proto...", flush=True)
        subprocess.run([sys.executable, str(RAIZ / "scripts" / "gerar_proto.py")], check=True)
        # a pasta gen/ pode ter acabado de ser criada: o Python precisa reler o caminho
        sys.path_importer_cache.pop(str(GEN), None)
        importlib.invalidate_caches()
