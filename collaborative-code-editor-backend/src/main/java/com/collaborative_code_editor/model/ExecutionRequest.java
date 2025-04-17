package com.collaborative_code_editor.model;

import lombok.Data;

@Data
public class ExecutionRequest {
    private String code;
    private String input;
    private String language;

    private String projectId;
    private String filePath;
    private String executedBy; // GitHub ID or internal user ID
}
