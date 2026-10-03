package com.notepilot.notepilot;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
public class NotepilotApplication {
    public static void main(String[] args) {
        SpringApplication.run(NotepilotApplication.class, args);
    }

    /** CORS origins come from the CORS_ORIGINS env var (comma separated). */
    @Bean
    WebMvcConfigurer cors(@Value("${app.cors.origins}") String[] origins) {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**").allowedOrigins(origins).allowedMethods("GET", "POST", "OPTIONS");
            }
        };
    }
}
