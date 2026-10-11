package br.ufc.estufa.api;

import br.ufc.estufa.api.Dtos.ConsultaDTO;
import br.ufc.estufa.api.Dtos.PontoDTO;
import br.ufc.estufa.api.Dtos.ResultadoDTO;
import br.ufc.estufa.gateway.GatewayTcpClient;
import br.ufc.estufa.proto.ConsultaAgregada;
import br.ufc.estufa.proto.ConsultaHistorico;
import br.ufc.estufa.proto.RequisicaoCliente;
import br.ufc.estufa.proto.RespostaGateway;
import br.ufc.estufa.proto.TipoConsulta;
import java.util.List;
import java.util.Locale;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** As 3 consultas agregadas e o histórico de leituras. */
@RestController
@RequestMapping("/api")
public class ConsultaController {

    private final GatewayTcpClient gateway;

    public ConsultaController(GatewayTcpClient gateway) {
        this.gateway = gateway;
    }

    @GetMapping("/consultas/tempo-acima-ideal")
    public ConsultaDTO tempoAcimaIdeal(@RequestParam(defaultValue = "3600") long janela,
                                       @RequestParam(defaultValue = "30") double limite,
                                       @RequestParam(defaultValue = "") String estufa) {
        return consultar(TipoConsulta.TEMPO_ACIMA_IDEAL, janela, limite, estufa);
    }

    @GetMapping("/consultas/media-umidade")
    public ConsultaDTO mediaUmidade(@RequestParam(defaultValue = "3600") long janela,
                                    @RequestParam(defaultValue = "") String estufa) {
        return consultar(TipoConsulta.MEDIA_UMIDADE_POR_ESTUFA, janela, 0, estufa);
    }

    @GetMapping("/consultas/pico-luminosidade")
    public ConsultaDTO picoLuminosidade(@RequestParam(defaultValue = "86400") long janela,
                                        @RequestParam(defaultValue = "") String estufa) {
        return consultar(TipoConsulta.PICO_LUMINOSIDADE, janela, 0, estufa);
    }

    private ConsultaDTO consultar(TipoConsulta tipo, long janela, double limite, String estufa) {
        if (janela <= 0) {
            throw new IllegalArgumentException("a janela deve ser maior que zero");
        }
        ConsultaAgregada.Builder consulta = ConsultaAgregada.newBuilder()
                .setTipo(tipo)
                .setJanelaS(janela)
                .setLimite(limite)
                .setEstufaId(estufa);
        RespostaGateway resp = gateway.enviar(RequisicaoCliente.newBuilder().setConsulta(consulta));
        List<ResultadoDTO> resultados = resp.getResultadosList().stream().map(ResultadoDTO::de).toList();
        return new ConsultaDTO(tipo.name(), janela, limite, descrever(consulta.build()), resultados);
    }

    /** Texto da mensagem enviada, mostrado na tela de consultas. */
    private static String descrever(ConsultaAgregada c) {
        StringBuilder sb = new StringBuilder("ConsultaAgregada { tipo: ").append(c.getTipo().name())
                .append(", janela_s: ").append(c.getJanelaS());
        if (c.getTipo() == TipoConsulta.TEMPO_ACIMA_IDEAL) {
            sb.append(", limite: ").append(String.format(Locale.ROOT, "%.1f", c.getLimite()));
        }
        if (!c.getEstufaId().isEmpty()) {
            sb.append(", estufa_id: \"").append(c.getEstufaId()).append('"');
        }
        return sb.append(" }").toString();
    }

    /** Série temporal de uma grandeza (ponto extra: histórico persistido no SQLite do Gateway). */
    @GetMapping("/historico")
    public List<PontoDTO> historico(@RequestParam String grandeza,
                                    @RequestParam(defaultValue = "") String estufa,
                                    @RequestParam(defaultValue = "") String fonte,
                                    @RequestParam(defaultValue = "0") long de,
                                    @RequestParam(defaultValue = "0") long ate,
                                    @RequestParam(defaultValue = "300") int maxPontos) {
        ConsultaHistorico.Builder h = ConsultaHistorico.newBuilder()
                .setGrandeza(grandeza)
                .setEstufaId(estufa)
                .setFonteId(fonte)
                .setDeMs(de)
                .setAteMs(ate)
                .setMaxPontos(maxPontos);
        RespostaGateway resp = gateway.enviar(RequisicaoCliente.newBuilder().setHistorico(h));
        return resp.getSerieList().stream().map(PontoDTO::de).toList();
    }
}
