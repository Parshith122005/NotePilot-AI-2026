package com.notepilot.notepilot.model;

import java.util.List;

public final class Study {
    private Study() {}
    public record QuizQuestion(String question, List<String> options, int correctIndex, String explanation) {}
    public record Flashcard(String front, String back) {}
}
