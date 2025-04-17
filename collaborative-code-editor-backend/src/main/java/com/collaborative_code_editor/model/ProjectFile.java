package com.collaborative_code_editor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectFile {
    private String name;
    private String type; // "file" or "folder"
    private String path; // Full path like "src/utils/helper.js"
//    private String content; // Only for files
    private List<ProjectFile> children = new ArrayList<>(); // Only for folders
}
