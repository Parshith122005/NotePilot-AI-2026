 package com.notepilot.notepilot.service;

import static org.junit.jupiter.api.Assertions.*;

import com.notepilot.notepilot.model.Study.Flashcard;
import com.notepilot.notepilot.model.Study.QuizQuestion;
import java.util.List;
import org.junit.jupiter.api.Test;

class AiServiceTest {

    private static final String QUIZ =
            "{\"questions\":[{\"question\":\"Q?\","
                    + "\"options\":[\"a\",\"b\"],"
                    + "\"correctIndex\":1,"
                    + "\"explanation\":\"e\"}]}";

    @Test
    void parsesFencedQuiz() {
        List<QuizQuestion> questions =
                AiService.parseQuiz("```json\n" + QUIZ + "\n```");

        assertEquals(1, questions.size());
        assertEquals(1, questions.get(0).correctIndex());
    }

    @Test
    void rejectsOutOfRangeAnswer() {
        String invalidQuiz = QUIZ.replace(
                "\"correctIndex\":1",
                "\"correctIndex\":5"
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> AiService.parseQuiz(invalidQuiz)
        );
    }

    @Test
    void rejectsMalformedAndNull() {
        assertThrows(
                IllegalArgumentException.class,
                () -> AiService.parseQuiz("{not json")
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> AiService.parseQuiz(null)
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> AiService.parseCards("   ")
        );
    }

    @Test
    void parsesCardsAndRejectsBlankBack() {
        String validCards =
                "{\"cards\":[{\"front\":\"x\",\"back\":\"y\"}]}";

        List<Flashcard> cards = AiService.parseCards(validCards);

        assertEquals(1, cards.size());

        String invalidCards =
                "{\"cards\":[{\"front\":\"x\",\"back\":\"\"}]}";

        assertThrows(
                IllegalArgumentException.class,
                () -> AiService.parseCards(invalidCards)
        );
    }

    @Test
    void missingTokenGivesConfigError() {
        AiService service = new AiService("", "gemini-2.5-flash-lite", 1);

        AiService.AiException exception = assertThrows(
                AiService.AiException.class,
                () -> service.summarize("notes")
        );

        assertEquals(503, exception.status());
    }

    @Test
    void paymentRequiredErrorExplainsHowToResolveIt() {
        String message = AiService.upstreamErrorMessage(402);

        assertNotNull(message);
        assertFalse(message.isBlank());

        assertEquals(
                "The AI service returned an error (HTTP 500).",
                AiService.upstreamErrorMessage(500)
        );
    }
}
