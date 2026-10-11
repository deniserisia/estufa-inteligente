package br.ufc.estufa;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Backend Java da Estufa Inteligente.
 *
 * É o "Cliente" do enunciado: conversa com o Gateway Python por socket TCP
 * usando Protocol Buffers e expõe uma API REST (JSON) para o frontend Angular.
 */
@SpringBootApplication
public class EstufaBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(EstufaBackendApplication.class, args);
    }
}
