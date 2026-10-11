"""Tela de sombreamento (fonte controlável): abertura de 0 a 100%.

Convenção: 100% = tela recolhida (sol pleno); 0% = tela toda estendida (sombra máxima).

Exemplo:
    python fontes/tela.py --id tela-e1 --estufa estufa-1 --porta-grpc 50053
"""
import _caminho  # noqa: F401  (ajusta os imports)

import estufa_pb2 as pb
from base_atuador import AtuadorBase


class Tela(AtuadorBase):
    TIPO = pb.TELA_SOMBREAMENTO
    TEM_LIGA = False
    TEM_NIVEL = True
    NOME_NIVEL = "abertura"
    CHAVE_AMBIENTE = "tela"
    NIVEL_PADRAO = 40.0

    def valores_ambiente(self) -> dict:
        return {"abertura": self.nivel}  # em falha, a tela fica parada onde está

    def medicoes(self):
        return [pb.Medicao(grandeza="abertura", valor=self.nivel, unidade="%")]


if __name__ == "__main__":
    Tela(Tela.parser("Tela de sombreamento da estufa").parse_args()).executar()
