package com.collaborative_code_editor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Collaborator {
    private String githubId;
    private String role;  // 'admin', 'editor', 'viewer'
}
