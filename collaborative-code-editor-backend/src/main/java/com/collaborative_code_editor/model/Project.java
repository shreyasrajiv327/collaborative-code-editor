package com.collaborative_code_editor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "projects")
public class Project {
    @Id
    private String name;
    private String repoUrl;
    private String owner;
    private String language;
    private String description;
    private List<String> collaborators = new ArrayList<>(); //just github id of collaborator
    private List<ProjectFile> files = new ArrayList<>(); // Represents the root level
}
