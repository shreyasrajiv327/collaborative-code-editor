package com.collaborative_code_editor.model;

import lombok.Data;
import java.util.Map;

@Data
public class CommitRequest {
    private String owner;
    private String repo;
    private Map<String, String> filesWithPaths;
    private String commitMessage;
}
