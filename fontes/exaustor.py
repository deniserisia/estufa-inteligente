"""Exaustor (fonte controlável): liga/desliga e velocidade de 0 a 100%.

Exemplo:
    python fontes/exaustor.py --id exaustor-e1 --estufa estufa-1 --porta-grpc 50051
"""
import _caminho  # noqa: F401  (ajusta os imports)

import estufa_pb2 as pb
from base_atuador import AtuadorBase


class Exaustor(AtuadorBase):
    TIPO = pb.EXAUSTOR
    TEM_NIVEL = True
    NOME_NIVEL = "velocidade"
    CHAVE_AMBIENTE = "exaustor"
    NIVEL_PADRAO = 60.0
    LIGADO_PADRAO = True

    def valores_ambiente(self) -> dict:
        return {"ativo": self.ligado and not self.em_falha, "nivel": self.nivel}

    def medicoes(self):
        velocidade = self.nivel if self.ligado else 0.0
        consumo = 15 + 3.2 * velocidade if self.ligado else 0.0  # watts, simulado
        return [
            pb.Medicao(grandeza="velocidade", valor=velocidade, unidade="%"),
            pb.Medicao(grandeza="consumo", valor=round(consumo, 1), unidade="W"),
        ]


if __name__ == "__main__":
    Exaustor(Exaustor.parser("Exaustor da estufa").parse_args()).executar()
