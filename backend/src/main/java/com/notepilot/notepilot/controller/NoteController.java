
        package com.notepilot.notepilot.controller;

import com.notepilot.notepilot.model.NoteRequest;
import com.notepilot.notepilot.service.AiService;
import com.notepilot.notepilot.service.AiService.AiException;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class NoteController {

    private static final Logger log =
            LoggerFactory.getLogger(NoteController.class);

    private final AiService aiService;
    private final int maxChars;

    public NoteController(
            AiService aiService,
            @Value("${app.max-chars:20000}") int maxChars) {
        this.aiService = aiService;
        this.maxChars = maxChars;
    }

    @GetMapping("/hello")
    public Map<String, String> hello() {
        return Map.of("status", "ok");
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping("/notes")
    public Map<String, Object> notes(
            @RequestBody(required = false) NoteRequest r) {
        return Map.of(
                "summary",
                aiService.summarize(check(r))
        );
    }

    @PostMapping("/quiz")
    public Map<String, Object> quiz(
            @RequestBody(required = false) NoteRequest r) {
        return Map.of(
                "questions",
                aiService.quiz(check(r))
        );
    }

    @PostMapping("/flashcards")
    public Map<String, Object> flashcards(
            @RequestBody(required = false) NoteRequest r) {
        return Map.of(
                "cards",
                aiService.flashcards(check(r))
        );
    }

    private String check(NoteRequest r) {
        if (r == null || r.text() == null || r.text().isBlank()) {
            throw new AiException(
                    400,
                    "Please provide some notes."
            );
        }

        if (r.text().length() > maxChars) {
            throw new AiException(
                    413,
                    "Notes are too long. Limit: "
                            + maxChars + " characters."
            );
        }

        return r.text().trim();
    }

    @ExceptionHandler(AiException.class)
    ResponseEntity<Map<String, String>> handle(AiException e) {
        return ResponseEntity
                .status(e.status())
                .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, String>> badBody(
            HttpMessageNotReadableException e) {
        return ResponseEntity
                .badRequest()
                .body(Map.of(
                        "error",
                        "Request body must be JSON like {\"text\": \"...\"}."
                ));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> unexpected(Exception e) {
        log.error(
                "Unexpected error: {}",
                e.getClass().getSimpleName()
        );

        return ResponseEntity
                .status(500)
                .body(Map.of("error", "Unexpected server error."));
    }
}
