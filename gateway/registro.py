"""Registro em memória das fontes conhecidas pelo Gateway (thread-safe)."""
import collections
import threading
from dataclasses import dataclass, field

import estufa_pb2 as pb
from comum import rede

ORDEM_TIPO = {
    pb.EXAUSTOR: 1, pb.NEBULIZADOR: 2, pb.TELA_SOMBREAMENTO: 3,
    pb.SENSOR_TEMP_UMIDADE: 4, pb.SENSOR_LUMINOSIDADE: 5, pb.SENSOR_CO2: 6,
}


@dataclass
class Fonte:
    info: pb.AnuncioFonte
    estado: pb.EstadoFonte
    online: bool = True
    ultimo_contato_ms: int = 0
    medicoes: list = field(default_factory=list)


class Registro:
    def __init__(self):
        self._fontes: dict[str, Fonte] = {}
        self._trava = threading.Lock()
        self._alertas: collections.deque = collections.deque(maxlen=100)

    # ------------------------------------------------------------ escrita

    def registrar(self, anuncio: pb.AnuncioFonte) -> tuple[bool, bool]:
        """Registra ou atualiza uma fonte. Devolve (é_nova, voltou_a_online)."""
        with self._trava:
            f = self._fontes.get(anuncio.fonte_id)
            if f is None:
                info = pb.AnuncioFonte()
                info.CopyFrom(anuncio)
                estado = pb.EstadoFonte()
                estado.CopyFrom(anuncio.estado_inicial)
                # uma fonte em falha simulada responde à descoberta, mas não envia dados
                self._fontes[anuncio.fonte_id] = Fonte(info=info, estado=estado,
                                                       online=not estado.em_falha,
                                                       ultimo_contato_ms=rede.agora_ms())
                return True, False
            em_falha = anuncio.estado_inicial.em_falha
            voltou = not f.online and not em_falha
            f.info.CopyFrom(anuncio)
            f.estado.CopyFrom(anuncio.estado_inicial)
            f.online = f.online if em_falha else True
            f.ultimo_contato_ms = rede.agora_ms()
            return False, voltou

    def atualizar_leitura(self, leitura: pb.Leitura) -> tuple[bool, bool]:
        """Guarda as últimas medições. Devolve (fonte_conhecida, voltou_a_online)."""
        with self._trava:
            f = self._fontes.get(leitura.fonte_id)
            if f is None:
                return False, False
            voltou = not f.online
            f.online = True
            f.ultimo_contato_ms = rede.agora_ms()
            f.medicoes = [pb.Medicao(grandeza=m.grandeza, valor=m.valor, unidade=m.unidade)
                          for m in leitura.medicoes]
            if leitura.HasField("estado"):
                f.estado.CopyFrom(leitura.estado)
            return True, voltou

    def atualizar_estado(self, fonte_id: str, estado: pb.EstadoFonte) -> None:
        with self._trava:
            f = self._fontes.get(fonte_id)
            if f is not None:
                f.estado.CopyFrom(estado)

    def marcar_offline(self, fonte_id: str) -> bool:
        with self._trava:
            f = self._fontes.get(fonte_id)
            if f is None or not f.online:
                return False
            f.online = False
            return True

    def verificar_inatividade(self) -> list[tuple[str, int]]:
        """Marca offline quem passou de 3 intervalos sem contato. Devolve (id, segundos)."""
        agora = rede.agora_ms()
        caidas = []
        with self._trava:
            for f in self._fontes.values():
                if not f.online:
                    continue
                intervalo = f.estado.intervalo_envio_s or 15.0
                limite_ms = max(3 * intervalo, 5) * 1000
                sem_contato = agora - f.ultimo_contato_ms
                if sem_contato > limite_ms:
                    f.online = False
                    caidas.append((f.info.fonte_id, int(sem_contato / 1000)))
        return caidas

    def adicionar_alerta(self, leitura: pb.Leitura) -> None:
        copia = pb.Leitura()
        copia.CopyFrom(leitura)
        with self._trava:
            self._alertas.appendleft(copia)

    # ------------------------------------------------------------ leitura

    def obter(self, fonte_id: str) -> pb.AnuncioFonte | None:
        with self._trava:
            f = self._fontes.get(fonte_id)
            if f is None:
                return None
            copia = pb.AnuncioFonte()
            copia.CopyFrom(f.info)
            return copia

    def tipo_de(self, fonte_id: str) -> int:
        with self._trava:
            f = self._fontes.get(fonte_id)
            return f.info.tipo if f else pb.TIPO_DESCONHECIDO

    def listar(self) -> list[pb.InfoFonte]:
        with self._trava:
            fontes = sorted(self._fontes.values(),
                            key=lambda f: (f.info.estufa_id, ORDEM_TIPO.get(f.info.tipo, 9), f.info.fonte_id))
            return [
                pb.InfoFonte(info=f.info, estado=f.estado, online=f.online,
                             ultimo_contato_ms=f.ultimo_contato_ms, ultimas_medicoes=f.medicoes)
                for f in fontes
            ]

    def alertas(self, limite: int = 50) -> list[pb.Leitura]:
        with self._trava:
            return list(self._alertas)[:limite]

    def contagem(self) -> tuple[int, int]:
        with self._trava:
            total = len(self._fontes)
            online = sum(1 for f in self._fontes.values() if f.online)
            return online, total
