"""Detecção de falhas: marca offline quem ficou mais de 3 intervalos sem enviar nada."""
import time

import estufa_pb2 as pb
from comum import log, rede


class Monitor:
    def __init__(self, registro):
        self._registro = registro

    def executar(self) -> None:
        while True:
            time.sleep(2)
            for fonte_id, segundos in self._registro.verificar_inatividade():
                log("monitor", f"{fonte_id} OFFLINE (sem leituras há {segundos} s)")
                info = self._registro.obter(fonte_id)
                self._registro.adicionar_alerta(pb.Leitura(
                    fonte_id=fonte_id,
                    tipo=info.tipo if info else pb.TIPO_DESCONHECIDO,
                    estufa_id=info.estufa_id if info else "",
                    timestamp_ms=rede.agora_ms(),
                    alerta=True,
                    motivo_alerta=f"fonte offline: sem leituras há {segundos} s",
                ))
