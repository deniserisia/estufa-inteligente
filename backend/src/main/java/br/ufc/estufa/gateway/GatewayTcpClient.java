package br.ufc.estufa.gateway;

import br.ufc.estufa.proto.RequisicaoCliente;
import br.ufc.estufa.proto.RespostaGateway;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Conexão TCP persistente com o Gateway.
 *
 * Framing: cada mensagem Protobuf vai precedida de 4 bytes big-endian com o
 * seu tamanho. {@code DataOutputStream.writeInt} e {@code DataInputStream.readInt}
 * usam exatamente esse formato, o mesmo do {@code struct.pack(">I")} do Python.
 */
@Component
public class GatewayTcpClient {

    private static final Logger log = LoggerFactory.getLogger(GatewayTcpClient.class);
    private static final int TAMANHO_MAXIMO = 16 * 1024 * 1024;

    private final String host;
    private final int porta;
    private Socket socket;
    private DataInputStream in;
    private DataOutputStream out;

    public GatewayTcpClient(@Value("${gateway.host:localhost}") String host,
                            @Value("${gateway.port:7000}") int porta) {
        this.host = host;
        this.porta = porta;
    }

    public String getHost() {
        return host;
    }

    public int getPorta() {
        return porta;
    }

    private void conectar() throws IOException {
        Socket s = new Socket();
        s.connect(new InetSocketAddress(host, porta), 2000);
        s.setSoTimeout(5000);
        s.setTcpNoDelay(true);
        socket = s;
        in = new DataInputStream(new BufferedInputStream(s.getInputStream()));
        out = new DataOutputStream(new BufferedOutputStream(s.getOutputStream()));
        log.info("Conectado ao Gateway em {}:{}", host, porta);
    }

    private void fechar() {
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignorada) {
                // nada a fazer
            }
        }
        socket = null;
    }

    /**
     * Envia uma requisição e espera a resposta. Se a conexão tiver caído,
     * reconecta e tenta mais uma vez.
     *
     * @throws GatewayIndisponivelException se o Gateway não responder
     * @throws GatewayErroException se o Gateway responder com sucesso = false
     */
    public synchronized RespostaGateway enviar(RequisicaoCliente.Builder requisicao) {
        RequisicaoCliente req = requisicao.setRequestId(UUID.randomUUID().toString().substring(0, 8)).build();
        IOException ultimoErro = null;
        for (int tentativa = 1; tentativa <= 2; tentativa++) {
            try {
                if (socket == null || socket.isClosed()) {
                    conectar();
                }
                byte[] dados = req.toByteArray();
                out.writeInt(dados.length);
                out.write(dados);
                out.flush();

                int tamanho = in.readInt();
                if (tamanho < 0 || tamanho > TAMANHO_MAXIMO) {
                    throw new IOException("tamanho de mensagem inválido: " + tamanho);
                }
                byte[] resposta = new byte[tamanho];
                in.readFully(resposta);
                RespostaGateway resp = RespostaGateway.parseFrom(resposta);
                if (!resp.getSucesso()) {
                    throw new GatewayErroException(resp.getErro());
                }
                return resp;
            } catch (IOException e) {
                ultimoErro = e;
                fechar();
            }
        }
        throw new GatewayIndisponivelException(
                "Gateway indisponível em " + host + ":" + porta + " (" + ultimoErro.getMessage() + ")");
    }
}
