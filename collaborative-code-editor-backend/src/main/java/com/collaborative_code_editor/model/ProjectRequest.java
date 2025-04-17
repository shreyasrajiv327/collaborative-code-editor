package com.collaborative_code_editor.model;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectRequest {

    @NotBlank(message = "Project name is required.")
    private String name;

    @NotBlank(message = "Project language is required.")
    private String language;

    @NotBlank(message = "Project description is required.")
    private String description;

    private List<Collaborator> collaborators;
}
