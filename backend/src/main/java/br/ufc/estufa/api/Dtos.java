package br.ufc.estufa.api;

import br.ufc.estufa.proto.EstadoFonte;
import br.ufc.estufa.proto.InfoFonte;
import br.ufc.estufa.proto.Leitura;
import br.ufc.estufa.proto.Medicao;
import br.ufc.estufa.proto.PontoSerie;
import br.ufc.estufa.proto.ResultadoAgregado;
import java.util.List;

/**
 * Objetos JSON da API REST e a conversão a partir das mensagens Protobuf.
 * Usar DTOs deixa o JSON limpo para o Angular (ex.: timestamps como número).
 */
public final class Dtos {

    private Dtos() {
    }

    public record MedicaoDTO(String grandeza, double valor, String unidade) {
        static MedicaoDTO de(Medicao m) {
            return new MedicaoDTO(m.getGrandeza(), m.getValor(), m.getUnidade());
        }
    }

    public record EstadoDTO(boolean ligado, double nivel, double intervaloEnvioS, boolean emFalha) {
        static EstadoDTO de(EstadoFonte e) {
            return new EstadoDTO(e.getLigado(), e.getNivel(), e.getIntervaloEnvioS(), e.getEmFalha());
        }
    }

    public record FonteDTO(String id, String tipo, String estufa, String ip, int portaGrpc,
                           boolean controlavel, boolean online, long ultimoContatoMs,
                           EstadoDTO estado, List<MedicaoDTO> medicoes) {
        static FonteDTO de(InfoFonte f) {
            var i = f.getInfo();
            return new FonteDTO(i.getFonteId(), i.getTipo().name(), i.getEstufaId(), i.getIp(),
                    i.getPortaGrpc(), i.getControlavel(), f.getOnline(), f.getUltimoContatoMs(),
                    EstadoDTO.de(f.getEstado()),
                    f.getUltimasMedicoesList().stream().map(MedicaoDTO::de).toList());
        }
    }

    public record AlertaDTO(String fonteId, String estufa, String tipo, long timestampMs,
                            String motivo, List<MedicaoDTO> medicoes) {
        static AlertaDTO de(Leitura l) {
            return new AlertaDTO(l.getFonteId(), l.getEstufaId(), l.getTipo().name(), l.getTimestampMs(),
                    l.getMotivoAlerta(), l.getMedicoesList().stream().map(MedicaoDTO::de).toList());
        }
    }

    public record ResultadoDTO(String estufa, double valor, String unidade, long timestampMs, long amostras) {
        static ResultadoDTO de(ResultadoAgregado r) {
            return new ResultadoDTO(r.getEstufaId(), r.getValor(), r.getUnidade(), r.getTimestampMs(),
                    r.getAmostras());
        }
    }

    /** Resposta das consultas: inclui a mensagem enviada, para a tela mostrar o que trafegou. */
    public record ConsultaDTO(String tipo, long janelaS, double limite, String mensagemEnviada,
                              List<ResultadoDTO> resultados) {
    }

    public record PontoDTO(long timestampMs, double valor, String fonteId, boolean alerta) {
        static PontoDTO de(PontoSerie p) {
            return new PontoDTO(p.getTimestampMs(), p.getValor(), p.getFonteId(), p.getAlerta());
        }
    }

    public record ComandoRequest(String tipo, Double valor) {
    }

    public record ComandoResposta(String fonteId, String comando, EstadoDTO estado) {
    }

    public record StatusDTO(boolean gatewayConectado, String gateway, int fontesOnline, int fontesTotal,
                            String erro) {
    }

    public record ErroDTO(String erro) {
    }
}
