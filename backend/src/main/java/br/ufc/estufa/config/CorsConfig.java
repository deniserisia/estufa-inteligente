package br.ufc.estufa.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Libera o Angular em desenvolvimento (localhost:4200) para chamar a API.
 * Com o proxy do Angular (proxy.conf.json) isto nem é necessário, mas ajuda
 * quando o frontend é aberto de outro endereço.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*")
                .allowedMethods("GET", "POST");
    }
}
