package br.ufc.estufa.gateway;

/** O Gateway não está rodando ou não respondeu pelo TCP. Vira HTTP 502. */
public class GatewayIndisponivelException extends RuntimeException {

    public GatewayIndisponivelException(String mensagem) {
        super(mensagem);
    }
}
