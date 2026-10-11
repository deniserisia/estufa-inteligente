"""Sensor de CO2 (fonte NÃO controlável). Envia ppm periodicamente por UDP.

Exemplo:
    python fontes/sensor_co2.py --id co2-e1 --estufa estufa-1
"""
import _caminho  # noqa: F401  (ajusta os imports)

import ambiente
import estufa_pb2 as pb
from base import FonteBase, ruido


class SensorCO2(FonteBase):
    TIPO = pb.SENSOR_CO2
    INTERVALO_PADRAO = 15.0

    def __init__(self, args):
        super().__init__(args)
        self.co2 = ambiente.co2_alvo(ambiente.ler(self.estufa), ambiente.hora_simulada(self.aceleracao))

    def passo(self):
        alvo = ambiente.co2_alvo(ambiente.ler(self.estufa), ambiente.hora_simulada(self.aceleracao))
        with self.trava:
            self.co2 += (alvo - self.co2) * 0.05  # o ar demora a renovar
        return None

    def medicoes(self):
        return [pb.Medicao(grandeza="co2", valor=round(self.co2 + ruido(3)), unidade="ppm")]


if __name__ == "__main__":
    SensorCO2(SensorCO2.parser("Sensor de CO2").parse_args()).executar()
