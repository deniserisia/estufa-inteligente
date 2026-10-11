"""As 3 consultas analíticas agregadas, em SQL sobre a tabela de leituras."""
import estufa_pb2 as pb
from comum import rede

# Entre duas leituras consecutivas, conta no máximo 30 s. Assim um sensor
# desligado por 10 minutos não soma 10 minutos inteiros acima do limite.
LACUNA_MAXIMA_MS = 30_000

SQL_TEMPO_ACIMA = """
WITH serie AS (
  SELECT estufa_id, valor, ts_ms,
         LEAD(ts_ms) OVER (PARTITION BY estufa_id ORDER BY ts_ms) AS prox_ts
  FROM leituras
  WHERE grandeza = 'temperatura' AND ts_ms >= :desde {filtro}
)
SELECT estufa_id,
       SUM(CASE WHEN valor > :limite
                THEN MIN(COALESCE(prox_ts, :agora) - ts_ms, :lacuna)
                ELSE 0 END) / 1000.0 AS segundos,
       COUNT(*) AS amostras
FROM serie
GROUP BY estufa_id
ORDER BY estufa_id
"""

SQL_MEDIA_UMIDADE = """
SELECT estufa_id, AVG(valor) AS media, COUNT(*) AS amostras
FROM leituras
WHERE grandeza = 'umidade' AND ts_ms >= :desde {filtro}
GROUP BY estufa_id
ORDER BY estufa_id
"""

# No SQLite, uma coluna sem agregação ao lado de MAX vem da linha do máximo:
# ts_ms é o instante do pico.
SQL_PICO_LUZ = """
SELECT estufa_id, MAX(valor) AS pico, ts_ms, COUNT(*) AS amostras
FROM leituras
WHERE grandeza = 'luminosidade' AND ts_ms >= :desde {filtro}
GROUP BY estufa_id
ORDER BY estufa_id
"""


def executar(armazenamento, c: pb.ConsultaAgregada) -> list[pb.ResultadoAgregado]:
    agora = rede.agora_ms()
    janela_s = c.janela_s or 3600
    params = {"desde": agora - janela_s * 1000, "agora": agora,
              "limite": c.limite or 30.0, "lacuna": LACUNA_MAXIMA_MS}
    filtro = ""
    if c.estufa_id:
        filtro = "AND estufa_id = :estufa"
        params["estufa"] = c.estufa_id

    if c.tipo == pb.TEMPO_ACIMA_IDEAL:
        linhas = armazenamento.consultar(SQL_TEMPO_ACIMA.format(filtro=filtro), params)
        return [pb.ResultadoAgregado(estufa_id=r["estufa_id"], valor=r["segundos"] or 0.0,
                                     unidade="s", amostras=r["amostras"]) for r in linhas]
    if c.tipo == pb.MEDIA_UMIDADE_POR_ESTUFA:
        linhas = armazenamento.consultar(SQL_MEDIA_UMIDADE.format(filtro=filtro), params)
        return [pb.ResultadoAgregado(estufa_id=r["estufa_id"], valor=r["media"], unidade="%",
                                     amostras=r["amostras"]) for r in linhas]
    if c.tipo == pb.PICO_LUMINOSIDADE:
        linhas = armazenamento.consultar(SQL_PICO_LUZ.format(filtro=filtro), params)
        return [pb.ResultadoAgregado(estufa_id=r["estufa_id"], valor=r["pico"], unidade="lux",
                                     timestamp_ms=r["ts_ms"], amostras=r["amostras"]) for r in linhas]
    raise ValueError("tipo de consulta desconhecido")
