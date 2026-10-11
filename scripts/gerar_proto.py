"""Gera o código Python a partir de proto/estufa.proto.

Uso (na raiz do projeto):  python scripts/gerar_proto.py

O código Java é gerado pelo Maven automaticamente (backend/pom.xml).
"""
import pathlib
import sys

from grpc_tools import protoc

RAIZ = pathlib.Path(__file__).resolve().parents[1]
PROTO_DIR = RAIZ / "proto"
GEN_DIR = RAIZ / "gen"


def main() -> int:
    GEN_DIR.mkdir(exist_ok=True)
    (GEN_DIR / "__init__.py").touch()
    # include das definições padrão do protobuf que vêm com o grpc_tools
    import grpc_tools
    include_padrao = pathlib.Path(grpc_tools.__file__).parent / "_proto"
    args = [
        "grpc_tools.protoc",
        f"-I{PROTO_DIR}",
        f"-I{include_padrao}",
        f"--python_out={GEN_DIR}",
        f"--pyi_out={GEN_DIR}",
        f"--grpc_python_out={GEN_DIR}",
        str(PROTO_DIR / "estufa.proto"),
    ]
    codigo = protoc.main(args)
    if codigo == 0:
        print(f"Código gerado em {GEN_DIR}")
    else:
        print("Falha ao gerar o código. Confira o arquivo .proto.")
    return codigo


if __name__ == "__main__":
    sys.exit(main())
