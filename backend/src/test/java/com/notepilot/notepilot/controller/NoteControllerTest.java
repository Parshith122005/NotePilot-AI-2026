 package com.notepilot.notepilot.controller;

import com.notepilot.notepilot.service.AiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class NoteControllerTest {

    private AiService aiService;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        aiService = mock(AiService.class);

        mvc = MockMvcBuilders
                .standaloneSetup(new NoteController(aiService, 20000))
                .build();
    }

    @Test
    void helloReturnsOk() throws Exception {
        mvc.perform(get("/api/hello"))
                .andExpect(status().isOk());
    }

    @Test
    void blankNotesAreRejected() throws Exception {
        mvc.perform(post("/api/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());

        verifyNoInteractions(aiService);
    }

    @Test
    void missingBodyIsRejected() throws Exception {
        mvc.perform(post("/api/quiz"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(aiService);
    }

    @Test
    void summaryReturnsSummaryField() throws Exception {
        when(aiService.summarize("my notes"))
                .thenReturn("# Title");

        mvc.perform(post("/api/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"my notes\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value("# Title"));

        verify(aiService).summarize("my notes");
    }

    @Test
    void flashcardsReturnCardsField() throws Exception {
        when(aiService.flashcards("my notes"))
                .thenReturn(java.util.List.of());

        mvc.perform(post("/api/flashcards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"my notes\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards").isArray());

        verify(aiService).flashcards("my notes");
    }

    @Test
    void aiFailureReturns502() throws Exception {
        when(aiService.quiz("my notes"))
                .thenThrow(new AiService.AiException(502, "boom"));

        mvc.perform(post("/api/quiz")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"my notes\"}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("boom"));

        verify(aiService).quiz("my notes");
    }
}
