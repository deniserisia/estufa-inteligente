"""Coloca a raiz do projeto e a pasta gen/ no caminho de imports."""
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[1]
for _p in (str(RAIZ), str(RAIZ / "gen")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from comum.preparar import garantir_codigo_gerado  # noqa: E402

garantir_codigo_gerado()
