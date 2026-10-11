package br.ufc.estufa.api;

import br.ufc.estufa.api.Dtos.ErroDTO;
import br.ufc.estufa.gateway.GatewayErroException;
import br.ufc.estufa.gateway.GatewayIndisponivelException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Converte as exceções em respostas JSON { "erro": "..." } com o status HTTP certo. */
@RestControllerAdvice
public class ErroHandler {

    @ExceptionHandler(GatewayIndisponivelException.class)
    public ResponseEntity<ErroDTO> indisponivel(GatewayIndisponivelException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(new ErroDTO(e.getMessage()));
    }

    @ExceptionHandler(GatewayErroException.class)
    public ResponseEntity<ErroDTO> recusado(GatewayErroException e) {
        return ResponseEntity.badRequest().body(new ErroDTO(e.getMessage()));
    }

    @ExceptionHandler({IllegalArgumentException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ErroDTO> invalido(Exception e) {
        return ResponseEntity.badRequest().body(new ErroDTO(e.getMessage()));
    }
}
