"""Gera o código a partir de proto/estufa.proto.

Uso (de qualquer pasta):
    python scripts/gerar_proto.py           # Python, em gen/ (feito sozinho na 1ª execução)
    python scripts/gerar_proto.py --java    # Java, em backend/src/main/java (só se mudar o .proto)

O --java precisa do protoc 30.2:  pip install protoc-wheel-0==30.2
(as classes Java já vêm prontas no projeto; só é preciso gerar de novo se o .proto mudar)
"""
import os
import pathlib
import shutil
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[1]


def gerar_python() -> int:
    from grpc_tools import protoc

    (RAIZ / "gen").mkdir(exist_ok=True)
    (RAIZ / "gen" / "__init__.py").touch()
    # caminhos relativos à raiz: evita problemas com acentos e espaços
    # (ex.: "Área de Trabalho") no caminho completo, no Windows
    anterior = os.getcwd()
    os.chdir(RAIZ)
    try:
        codigo = protoc.main([
            "grpc_tools.protoc", "-Iproto",
            "--python_out=gen", "--pyi_out=gen", "--grpc_python_out=gen",
            "proto/estufa.proto",
        ])
    finally:
        os.chdir(anterior)
    print("Código Python gerado em gen/" if codigo == 0 else "Falha ao gerar o código Python.")
    return codigo


def gerar_java() -> int:
    protoc = shutil.which("protoc")
    if protoc is None:
        print("protoc não encontrado. Instale com:  pip install protoc-wheel-0==30.2")
        return 1
    destino = "backend/src/main/java"
    shutil.rmtree(RAIZ / destino / "br" / "ufc" / "estufa" / "proto", ignore_errors=True)
    codigo = subprocess.run([protoc, "-Iproto", f"--java_out={destino}", "proto/estufa.proto"], cwd=RAIZ).returncode
    print(f"Código Java gerado em {destino}/br/ufc/estufa/proto" if codigo == 0 else "Falha ao gerar o código Java.")
    return codigo


if __name__ == "__main__":
    sys.exit(gerar_java() if "--java" in sys.argv else gerar_python())
