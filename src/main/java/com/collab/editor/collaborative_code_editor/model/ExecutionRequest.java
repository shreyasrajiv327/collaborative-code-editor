package com.collab.editor.collaborative_code_editor.model;

public class ExecutionRequest {
    private String sourceCode;
    private int languageId;
    private String stdin;

    // Constructors
    public ExecutionRequest() {
    }

    public ExecutionRequest(String sourceCode, int languageId, String stdin) {
        this.sourceCode = sourceCode;
        this.languageId = languageId;
        this.stdin = stdin;
    }

    // Getters and Setters
    public String getSourceCode() {
        return sourceCode;
    }

    public void setSourceCode(String sourceCode) {
        this.sourceCode = sourceCode;
    }

    public int getLanguageId() {
        return languageId;
    }

    public void setLanguageId(int languageId) {
        this.languageId = languageId;
    }

    public String getStdin() {
        return stdin;
    }

    public void setStdin(String stdin) {
        this.stdin = stdin;
    }
}
