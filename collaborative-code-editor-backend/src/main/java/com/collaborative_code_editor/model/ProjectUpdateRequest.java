package com.collaborative_code_editor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectUpdateRequest {

    private String description; // Optional field for updating the project description
    private List<Collaborator> collaborators; // Optional field for updating the collaborators
}
