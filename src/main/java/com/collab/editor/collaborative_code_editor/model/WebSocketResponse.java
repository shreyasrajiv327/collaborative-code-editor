package com.collab.editor.collaborative_code_editor.model;

public class WebSocketResponse {
    private String message;

    public WebSocketResponse(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
