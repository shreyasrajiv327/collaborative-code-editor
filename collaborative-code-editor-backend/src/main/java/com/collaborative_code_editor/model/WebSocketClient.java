package com.collaborative_code_editor.model;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Getter
@Setter
@NoArgsConstructor
public class WebSocketClient {
    private String userId;
    private String projectId;

    public WebSocketClient(String userId, String projectId) {
        this.userId = userId;
        this.projectId = projectId;
    }
}