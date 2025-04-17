package com.collaborative_code_editor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CollaborationMessage {
    private String projectId;
    private String senderId;
    private String type;     // e.g. "edit", "chat", "join", etc.
    private String content;  // code or message content
    private long timestamp;
}
