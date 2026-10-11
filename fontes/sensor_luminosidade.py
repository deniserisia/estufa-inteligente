"""Sensor de luminosidade (fonte NÃO controlável). Envia lux periodicamente por UDP.

Exemplo:
    python fontes/sensor_luminosidade.py --id luz-e1 --estufa estufa-1
"""
import _caminho  # noqa: F401  (ajusta os imports)

import ambiente
import estufa_pb2 as pb
from base import FonteBase, ruido


class SensorLuminosidade(FonteBase):
    TIPO = pb.SENSOR_LUMINOSIDADE
    INTERVALO_PADRAO = 15.0

    def __init__(self, args):
        super().__init__(args)
        self.lux = ambiente.luz_interna(ambiente.ler(self.estufa), ambiente.hora_simulada(self.aceleracao))

    def passo(self):
        alvo = ambiente.luz_interna(ambiente.ler(self.estufa), ambiente.hora_simulada(self.aceleracao))
        with self.trava:
            self.lux += (alvo - self.lux) * 0.3  # a tela leva alguns segundos para se mover
        return None

    def medicoes(self):
        valor = max(0.0, self.lux * (1 + ruido(0.003)))
        return [pb.Medicao(grandeza="luminosidade", valor=round(valor), unidade="lux")]


if __name__ == "__main__":
    SensorLuminosidade(SensorLuminosidade.parser("Sensor de luminosidade").parse_args()).executar()
