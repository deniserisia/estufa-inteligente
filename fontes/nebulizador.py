"""Nebulizador (fonte controlável): liga e desliga. Ligado, esfria e umidifica a estufa.

Exemplo:
    python fontes/nebulizador.py --id nebulizador-e1 --estufa estufa-1 --porta-grpc 50052
"""
import _caminho  # noqa: F401  (ajusta os imports)

import estufa_pb2 as pb
from base_atuador import AtuadorBase


class Nebulizador(AtuadorBase):
    TIPO = pb.NEBULIZADOR
    CHAVE_AMBIENTE = "nebulizador"
    LIGADO_PADRAO = False
    VAZAO_LH = 30.0  # litros por hora quando ligado

    def valores_ambiente(self) -> dict:
        return {"ativo": self.ligado and not self.em_falha}

    def medicoes(self):
        return [
            pb.Medicao(grandeza="ligado", valor=1.0 if self.ligado else 0.0, unidade=""),
            pb.Medicao(grandeza="vazao", valor=self.VAZAO_LH if self.ligado else 0.0, unidade="L/h"),
        ]


if __name__ == "__main__":
    Nebulizador(Nebulizador.parser("Nebulizador da estufa").parse_args()).executar()
