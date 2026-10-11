package br.ufc.estufa.gateway;

/** O Gateway respondeu com sucesso = false (ex.: comando recusado). Vira HTTP 400. */
public class GatewayErroException extends RuntimeException {

    public GatewayErroException(String mensagem) {
        super(mensagem);
    }
}
