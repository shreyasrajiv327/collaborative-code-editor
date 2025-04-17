package com.collaborative_code_editor.model;

import lombok.Data;

@Data
public class FileRequest {
    private String path;       // "src/main/App.js" or "src/main"
    private String content;    // Optional, only for files
    private String language;   // e.g. "javascript"
    private boolean isFolder;  // true for folder, false for file
}
