package com.collaborative_code_editor.service;

import com.collaborative_code_editor.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import com.collaborative_code_editor.model.Project;
import com.collaborative_code_editor.repository.ProjectRepository;

import java.util.ArrayList;
import java.util.List;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;

    // Constructor injection for ProjectRepository
    @Autowired
    public ProjectService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    // Method to store the repo details in MongoDB after successful creation
    public void storeRepoDetails(String repoName, String description, String language, List<String> collaboratorUsernames) {
//        String owner = SecurityContextHolder.getContext().getAuthentication().getName().;
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String owner = user.getGithubLogin();

        // Create a new Project object to store in MongoDB
        Project project = new Project();
        project.setName(repoName);
        project.setDescription(description);
        project.setLanguage(language);
        project.setOwner(owner); // Set the owner or get from authentication context
        project.setCollaborators(collaboratorUsernames); // Add any collaborators if needed

        // Save the project to MongoDB
        projectRepository.save(project);

        System.out.println("✅ Project details stored in MongoDB for repo: " + repoName);
    }

    public void addCollaboratorToProject(String projectName, String collaboratorGithubId) {
        Project project = projectRepository.findById(projectName)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        // Add collaborator to MongoDB project
        if (!project.getCollaborators().contains(collaboratorGithubId)) {
            project.getCollaborators().add(collaboratorGithubId);
            projectRepository.save(project);
        } else {
            throw new RuntimeException("Collaborator already exists in the project");
        }
    }

    public void removeCollaboratorFromProject(String projectName, String collaboratorGithubId) {
        Project project = projectRepository.findById(projectName)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        if (project.getCollaborators().contains(collaboratorGithubId)) {
            project.getCollaborators().remove(collaboratorGithubId);
            projectRepository.save(project);
        } else {
            throw new RuntimeException("Collaborator not found in the project");
        }
    }

}

