package com.notepilot.notepilot.service;

import static org.junit.jupiter.api.Assertions.*;

import com.notepilot.notepilot.model.Study.QuizQuestion;
import java.util.List;
import org.junit.jupiter.api.Test;

class AiServiceTest {
    private static final String QUIZ = "{\"questions\":[{\"question\":\"Q?\",\"options\":[\"a\",\"b\"],\"correctIndex\":1,\"explanation\":\"e\"}]}";

    @Test void parsesFencedQuiz() {
        List<QuizQuestion> qs = AiService.parseQuiz("```json\n" + QUIZ + "\n```");
        assertEquals(1, qs.size());
        assertEquals(1, qs.get(0).correctIndex());
    }
    @Test void rejectsOutOfRangeAnswer() {
        assertThrows(IllegalArgumentException.class, () -> AiService.parseQuiz(QUIZ.replace("\"correctIndex\":1", "\"correctIndex\":5")));
    }
    @Test void rejectsMalformedAndNull() {
        assertThrows(IllegalArgumentException.class, () -> AiService.parseQuiz("{not json"));
        assertThrows(IllegalArgumentException.class, () -> AiService.parseQuiz(null));
        assertThrows(IllegalArgumentException.class, () -> AiService.parseCards("   "));
    }
    @Test void parsesCardsAndRejectsBlankBack() {
        assertEquals(1, AiService.parseCards("{\"cards\":[{\"front\":\"x\",\"back\":\"y\"}]}").size());
        assertThrows(IllegalArgumentException.class, () -> AiService.parseCards("{\"cards\":[{\"front\":\"x\",\"back\":\"\"}]}"));
    }
    @Test void extractsContentAndRejectsNullContent() {
        assertEquals("hi", AiService.extractContent("{\"choices\":[{\"message\":{\"content\":\"hi\"}}]}"));
        AiService.AiException e = assertThrows(AiService.AiException.class,
                () -> AiService.extractContent("{\"choices\":[{\"message\":{\"content\":null}}]}"));
        assertEquals(502, e.status());
    }
    @Test void missingTokenGivesConfigError() {
        AiService svc = new AiService("", "m", "http://localhost:1", 1);
        AiService.AiException e = assertThrows(AiService.AiException.class, () -> svc.summarize("notes"));
        assertEquals(503, e.status());
    }
}
