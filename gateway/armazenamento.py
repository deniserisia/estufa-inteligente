"""Persistência em SQLite (ponto extra): leituras, fontes e comandos."""
import sqlite3
import threading

import estufa_pb2 as pb
from comum import rede

ESQUEMA = """
CREATE TABLE IF NOT EXISTS leituras (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fonte_id      TEXT    NOT NULL,
  estufa_id     TEXT    NOT NULL,
  tipo          TEXT    NOT NULL,
  grandeza      TEXT    NOT NULL,
  valor         REAL    NOT NULL,
  unidade       TEXT,
  ts_ms         INTEGER NOT NULL,
  alerta        INTEGER NOT NULL DEFAULT 0,
  motivo_alerta TEXT
);
CREATE INDEX IF NOT EXISTS idx_leituras ON leituras (estufa_id, grandeza, ts_ms);

CREATE TABLE IF NOT EXISTS fontes (
  fonte_id          TEXT PRIMARY KEY,
  tipo              TEXT,
  estufa_id         TEXT,
  ip                TEXT,
  porta_grpc        INTEGER,
  controlavel       INTEGER,
  ultimo_contato_ms INTEGER
);

CREATE TABLE IF NOT EXISTS comandos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  fonte_id TEXT,
  tipo     TEXT,
  valor    REAL,
  sucesso  INTEGER,
  erro     TEXT,
  ts_ms    INTEGER
);
"""


class Armazenamento:
    def __init__(self, caminho: str):
        self._conn = sqlite3.connect(caminho, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._trava = threading.Lock()
        with self._trava:
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.executescript(ESQUEMA)
            self._conn.commit()

    # ------------------------------------------------------------ escrita

    def salvar_leitura(self, leitura: pb.Leitura) -> None:
        tipo = pb.TipoFonte.Name(leitura.tipo)
        linhas = [
            (leitura.fonte_id, leitura.estufa_id, tipo, m.grandeza, m.valor, m.unidade,
             leitura.timestamp_ms or rede.agora_ms(), int(leitura.alerta), leitura.motivo_alerta or None)
            for m in leitura.medicoes
        ]
        with self._trava:
            self._conn.executemany(
                "INSERT INTO leituras (fonte_id, estufa_id, tipo, grandeza, valor, unidade, ts_ms,"
                " alerta, motivo_alerta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", linhas)
            self._conn.execute("UPDATE fontes SET ultimo_contato_ms = ? WHERE fonte_id = ?",
                               (rede.agora_ms(), leitura.fonte_id))
            self._conn.commit()

    def salvar_fonte(self, a: pb.AnuncioFonte) -> None:
        with self._trava:
            self._conn.execute(
                "INSERT INTO fontes (fonte_id, tipo, estufa_id, ip, porta_grpc, controlavel, ultimo_contato_ms)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)"
                " ON CONFLICT(fonte_id) DO UPDATE SET tipo=excluded.tipo, estufa_id=excluded.estufa_id,"
                " ip=excluded.ip, porta_grpc=excluded.porta_grpc, controlavel=excluded.controlavel,"
                " ultimo_contato_ms=excluded.ultimo_contato_ms",
                (a.fonte_id, pb.TipoFonte.Name(a.tipo), a.estufa_id, a.ip, a.porta_grpc,
                 int(a.controlavel), rede.agora_ms()))
            self._conn.commit()

    def salvar_comando(self, c: pb.ComandoCliente, sucesso: bool, erro: str = "") -> None:
        with self._trava:
            self._conn.execute(
                "INSERT INTO comandos (fonte_id, tipo, valor, sucesso, erro, ts_ms) VALUES (?, ?, ?, ?, ?, ?)",
                (c.fonte_id, pb.TipoComando.Name(c.tipo), c.valor, int(sucesso), erro or None, rede.agora_ms()))
            self._conn.commit()

    # ------------------------------------------------------------ leitura

    def consultar(self, sql: str, parametros: dict | tuple = ()) -> list[sqlite3.Row]:
        with self._trava:
            return self._conn.execute(sql, parametros).fetchall()

    def alertas_recentes(self, limite: int = 50) -> list[pb.Leitura]:
        """Últimas leituras de alerta gravadas (para o Gateway não perdê-las ao reiniciar)."""
        linhas = self.consultar(
            "SELECT fonte_id, estufa_id, tipo, ts_ms, motivo_alerta, grandeza, valor, unidade FROM leituras"
            " WHERE alerta = 1 ORDER BY ts_ms DESC, id LIMIT ?", (limite * 4,))
        alertas: dict[tuple[str, int], pb.Leitura] = {}
        for r in linhas:
            chave = (r["fonte_id"], r["ts_ms"])
            if chave not in alertas:
                if len(alertas) >= limite:
                    break
                alertas[chave] = pb.Leitura(
                    fonte_id=r["fonte_id"], estufa_id=r["estufa_id"], tipo=pb.TipoFonte.Value(r["tipo"]),
                    timestamp_ms=r["ts_ms"], alerta=True, motivo_alerta=r["motivo_alerta"] or "")
            alertas[chave].medicoes.add(grandeza=r["grandeza"], valor=r["valor"], unidade=r["unidade"])
        return list(alertas.values())

    def historico(self, c: pb.ConsultaHistorico) -> list[pb.PontoSerie]:
        """Série de uma grandeza; agrupa em faixas de tempo se houver pontos demais."""
        if not c.grandeza:
            raise ValueError("informe a grandeza do histórico (ex.: temperatura)")
        ate = c.ate_ms or rede.agora_ms()
        de = c.de_ms or ate - 3600 * 1000
        max_pontos = min(c.max_pontos or 300, 5000)
        sql = ("SELECT ts_ms, valor, fonte_id, alerta FROM leituras"
               " WHERE grandeza = :grandeza AND ts_ms BETWEEN :de AND :ate")
        params = {"grandeza": c.grandeza, "de": de, "ate": ate}
        if c.estufa_id:
            sql += " AND estufa_id = :estufa"
            params["estufa"] = c.estufa_id
        if c.fonte_id:
            sql += " AND fonte_id = :fonte"
            params["fonte"] = c.fonte_id
        sql += " ORDER BY ts_ms"
        linhas = self.consultar(sql, params)
        if len(linhas) <= max_pontos:
            return [pb.PontoSerie(timestamp_ms=r["ts_ms"], valor=r["valor"], fonte_id=r["fonte_id"],
                                  alerta=bool(r["alerta"])) for r in linhas]
        # muitas leituras: média por faixa de tempo
        largura = (ate - de) / max_pontos
        faixas: dict[int, list] = {}
        for r in linhas:
            faixas.setdefault(int((r["ts_ms"] - de) / largura), []).append(r)
        serie = []
        for indice in sorted(faixas):
            grupo = faixas[indice]
            serie.append(pb.PontoSerie(
                timestamp_ms=int(sum(r["ts_ms"] for r in grupo) / len(grupo)),
                valor=sum(r["valor"] for r in grupo) / len(grupo),
                fonte_id=grupo[-1]["fonte_id"],
                alerta=any(r["alerta"] for r in grupo)))
        return serie
