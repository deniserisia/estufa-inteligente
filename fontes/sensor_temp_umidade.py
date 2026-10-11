"""Sensor de temperatura e umidade (fonte NÃO controlável).

Envia leituras periódicas por UDP e, além disso, envia NA HORA quando a
temperatura passa do limite de alerta (35 °C por padrão). Usa histerese:
depois de disparar, só rearma quando a temperatura cair 1 °C abaixo do limite.

Exemplo:
    python fontes/sensor_temp_umidade.py --id temp-e1 --estufa estufa-1
    python fontes/sensor_temp_umidade.py --id temp-e2 --estufa estufa-2 --cenario quente
"""
import _caminho  # noqa: F401  (ajusta os imports)

import ambiente
import estufa_pb2 as pb
from base import FonteBase, ruido


class SensorTempUmidade(FonteBase):
    TIPO = pb.SENSOR_TEMP_UMIDADE
    INTERVALO_PADRAO = 15.0

    def __init__(self, args):
        super().__init__(args)
        self.limite = args.limite_alerta
        self.extra = 8.0 if args.cenario == "quente" else 0.0
        amb = ambiente.ler(self.estufa)
        h = ambiente.hora_simulada(self.aceleracao)
        self.temperatura = ambiente.temperatura_alvo(amb, h, self.extra)
        self.umidade = ambiente.umidade_alvo(amb, self.temperatura)
        self.armado = True  # se já começar acima do limite, alerta no primeiro segundo

    @classmethod
    def parser(cls, descricao):
        p = super().parser(descricao)
        p.add_argument("--limite-alerta", type=float, default=35.0, help="°C (padrão 35)")
        p.add_argument("--cenario", choices=["normal", "quente"], default="normal",
                       help="'quente' soma 8 °C ao clima externo, para provocar o alerta")
        return p

    def descricao_extra(self) -> str:
        cen = ", cenário QUENTE" if self.extra else ""
        return f", alerta acima de {self.limite:g} °C{cen}"

    def passo(self):
        amb = ambiente.ler(self.estufa)
        h = ambiente.hora_simulada(self.aceleracao)
        alvo_t = ambiente.temperatura_alvo(amb, h, self.extra)
        with self.trava:
            self.temperatura += (alvo_t - self.temperatura) * 0.1   # inércia térmica
            alvo_u = ambiente.umidade_alvo(amb, self.temperatura)
            self.umidade += (alvo_u - self.umidade) * 0.1
            # só dispara quando já conhece o Gateway, para o alerta não se perder
            if self.armado and self.temperatura > self.limite and self.gateway is not None:
                self.armado = False
                return f"temperatura {self.temperatura:.1f} °C acima de {self.limite:g} °C"
            if not self.armado and self.temperatura < self.limite - 1:
                self.armado = True
        return None

    def medicoes(self):
        return [
            pb.Medicao(grandeza="temperatura", valor=round(self.temperatura + ruido(0.05), 2), unidade="C"),
            pb.Medicao(grandeza="umidade", valor=round(self.umidade + ruido(0.2), 1), unidade="%"),
        ]


if __name__ == "__main__":
    SensorTempUmidade(SensorTempUmidade.parser("Sensor de temperatura e umidade").parse_args()).executar()
