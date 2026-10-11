"""Gera o código Python do .proto automaticamente quando ele falta ou está velho."""
import importlib
import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[1]
PROTO = RAIZ / "proto" / "estufa.proto"
GEN = RAIZ / "gen"
GERADOS = [GEN / "estufa_pb2.py", GEN / "estufa_pb2_grpc.py"]


def garantir_codigo_gerado() -> None:
    desatualizado = any(
        not g.exists() or g.stat().st_mtime < PROTO.stat().st_mtime for g in GERADOS
    )
    if desatualizado:
        print("Gerando código Python a partir de proto/estufa.proto...", flush=True)
        subprocess.run([sys.executable, str(RAIZ / "scripts" / "gerar_proto.py")], check=True)
        # a pasta gen/ pode ter acabado de ser criada: o Python precisa reler o caminho
        sys.path_importer_cache.pop(str(GEN), None)
        importlib.invalidate_caches()
