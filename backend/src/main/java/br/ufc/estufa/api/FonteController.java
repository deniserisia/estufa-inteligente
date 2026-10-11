package br.ufc.estufa.api;

import br.ufc.estufa.api.Dtos.AlertaDTO;
import br.ufc.estufa.api.Dtos.ComandoRequest;
import br.ufc.estufa.api.Dtos.ComandoResposta;
import br.ufc.estufa.api.Dtos.EstadoDTO;
import br.ufc.estufa.api.Dtos.FonteDTO;
import br.ufc.estufa.api.Dtos.StatusDTO;
import br.ufc.estufa.gateway.GatewayTcpClient;
import br.ufc.estufa.proto.ComandoCliente;
import br.ufc.estufa.proto.InfoFonte;
import br.ufc.estufa.proto.RequisicaoCliente;
import br.ufc.estufa.proto.RespostaGateway;
import br.ufc.estufa.proto.TipoComando;
import br.ufc.estufa.proto.Vazio;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Fontes, comandos, alertas e status. Cada rota vira uma RequisicaoCliente no TCP. */
@RestController
@RequestMapping("/api")
public class FonteController {

    private final GatewayTcpClient gateway;

    public FonteController(GatewayTcpClient gateway) {
        this.gateway = gateway;
    }

    /** Lista as fontes descobertas e seus estados (listar_fontes). */
    @GetMapping("/fontes")
    public List<FonteDTO> listar() {
        RespostaGateway resp = gateway.enviar(RequisicaoCliente.newBuilder().setListarFontes(Vazio.getDefaultInstance()));
        return resp.getFontesList().stream().map(FonteDTO::de).toList();
    }

    /** Envia um comando a uma fonte controlável (comando). O Gateway repassa por gRPC. */
    @PostMapping("/fontes/{id}/comandos")
    public ComandoResposta comando(@PathVariable String id, @RequestBody ComandoRequest corpo) {
        if (corpo == null || corpo.tipo() == null) {
            throw new IllegalArgumentException("informe o tipo do comando");
        }
        TipoComando tipo;
        try {
            tipo = TipoComando.valueOf(corpo.tipo().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("comando desconhecido: " + corpo.tipo()
                    + " (use LIGAR, DESLIGAR, AJUSTAR_NIVEL, AJUSTAR_INTERVALO, SIMULAR_FALHA ou ENCERRAR_FALHA)");
        }
        ComandoCliente.Builder cmd = ComandoCliente.newBuilder()
                .setFonteId(id)
                .setTipo(tipo)
                .setValor(corpo.valor() == null ? 0.0 : corpo.valor());
        RespostaGateway resp = gateway.enviar(RequisicaoCliente.newBuilder().setComando(cmd));
        return new ComandoResposta(id, tipo.name(), EstadoDTO.de(resp.getEstadoAtualizado()));
    }

    /** Alertas recentes guardados pelo Gateway (listar_alertas). */
    @GetMapping("/alertas")
    public List<AlertaDTO> alertas() {
        RespostaGateway resp = gateway.enviar(RequisicaoCliente.newBuilder().setListarAlertas(Vazio.getDefaultInstance()));
        return resp.getAlertasList().stream().map(AlertaDTO::de).toList();
    }

    /** Se o Gateway está acessível e quantas fontes estão online. Nunca falha. */
    @GetMapping("/status")
    public StatusDTO status() {
        String endereco = gateway.getHost() + ":" + gateway.getPorta();
        try {
            List<InfoFonte> fontes = gateway
                    .enviar(RequisicaoCliente.newBuilder().setListarFontes(Vazio.getDefaultInstance()))
                    .getFontesList();
            int online = (int) fontes.stream().filter(InfoFonte::getOnline).count();
            return new StatusDTO(true, endereco, online, fontes.size(), null);
        } catch (RuntimeException e) {
            return new StatusDTO(false, endereco, 0, 0, e.getMessage());
        }
    }
}
