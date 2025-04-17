package com.collaborative_code_editor.controller;

import com.collaborative_code_editor.model.User;
import com.collaborative_code_editor.model.ProjectFile;
import com.collaborative_code_editor.model.ProjectRequest;
import com.collaborative_code_editor.model.ProjectUpdateRequest;
import com.collaborative_code_editor.model.Project;
import com.collaborative_code_editor.model.Collaborator;
import com.collaborative_code_editor.service.GithubService;
import com.collaborative_code_editor.repository.ProjectRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;

import java.util.*;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private GithubService githubService;

    @GetMapping("/owned")
    public List<Project> getOwnedProjects(@AuthenticationPrincipal User currentUser) {
        String githubLogin = currentUser.getGithubLogin();
        System.out.println("currentUser proj controller:" + currentUser);
        System.out.println("githubLogin in owned:"+ githubLogin);

        List<Project> del = projectRepository.findByOwner(githubLogin);
        System.out.println("proj owned:"+ del);
        return del;
    }

    @GetMapping("/collaborating")
    public List<Project> getCollaboratingProjects(@AuthenticationPrincipal User currentUser) {
        String githubId = currentUser.getGithubLogin();
        return projectRepository.findByCollaboratorsContaining(githubId);
    }

    @GetMapping("/{name}")
    public Project getProject(@PathVariable String name, @AuthenticationPrincipal User currentUser) {
        Project project = projectRepository.findById(name)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        String githubId = currentUser.getGithubLogin();

        if (!project.getOwner().equals(githubId) &&
                !project.getCollaborators().contains(githubId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Unauthorized access");
        }

        return project;
    }

    @PutMapping("/{name}/update")
    public Project updateProject(@PathVariable String name, @RequestBody @Valid ProjectUpdateRequest projectUpdateRequest, @AuthenticationPrincipal User currentUser) {
        Project project = projectRepository.findById(name)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        String githubId = currentUser.getGithubLogin();

        // Check if the current user is the project owner or a collaborator
        if (!isOwnerOrCollaborator(project, githubId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Unauthorized to update project");
        }

        if (projectUpdateRequest.getDescription() != null) {
            project.setDescription(projectUpdateRequest.getDescription());
        }

        return projectRepository.save(project);
    }

    @PostMapping("/{projectName}/add-entry")
    public Project addEntryToProject(@PathVariable String projectName,
                                     @RequestBody ProjectFile newEntry,
                                     @AuthenticationPrincipal User currentUser) {
        Project project = projectRepository.findById(projectName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        String githubId = currentUser.getGithubLogin();

        // Check if the current user is the project owner or a collaborator
        if (!isOwnerOrCollaborator(project, githubId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized");
        }

        insertFileOrFolder(project.getFiles(), newEntry);
        return projectRepository.save(project);
    }

    private void insertFileOrFolder(List<ProjectFile> files, ProjectFile newEntry) {
        if (newEntry.getPath() == null || newEntry.getPath().isEmpty() || newEntry.getPath().startsWith("/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid path: Path cannot be empty or start with a '/'.");
        }

        String[] parts = newEntry.getPath().split("/");
        List<ProjectFile> current = files;

        for (int i = 0; i < parts.length; i++) {
            String part = parts[i];
            boolean isLast = i == parts.length - 1;

            ProjectFile existing = current.stream()
                    .filter(f -> f.getName().equals(part))
                    .findFirst()
                    .orElse(null);

            if (isLast) {
                if (existing != null && existing.getPath().equals(newEntry.getPath())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "File or folder already exists at this path");
                }
                current.add(newEntry);
                break;
            }

            if (existing == null) {
                existing = new ProjectFile(part, "folder", String.join("/", Arrays.copyOfRange(parts, 0, i + 1)), new ArrayList<>());
                current.add(existing);
            }

            current = existing.getChildren();
        }

        current.sort(Comparator.comparing(ProjectFile::getType).reversed().thenComparing(ProjectFile::getName));
    }

    @GetMapping("/{projectName}/files")
    public List<ProjectFile> getProjectFiles(@PathVariable String projectName,
                                             @AuthenticationPrincipal User currentUser) {
        Project project = projectRepository.findById(projectName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        String githubId = currentUser.getGithubLogin();

        // Check if the current user is the project owner or a collaborator
        if (!isOwnerOrCollaborator(project, githubId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized");
        }

        return project.getFiles();
    }

    @DeleteMapping("/{projectName}/delete-entry")
    public Project deleteEntry(@PathVariable String projectName,
                               @RequestParam String path,
                               @AuthenticationPrincipal User currentUser) {
        Project project = projectRepository.findById(projectName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        String githubId = currentUser.getGithubLogin();

        // Check if the current user is the project owner or a collaborator
        if (!isOwnerOrCollaborator(project, githubId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized");
        }

        if (!deleteEntryByPath(project.getFiles(), path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Entry not found to delete");
        }

        return projectRepository.save(project);
    }

    private boolean deleteEntryByPath(List<ProjectFile> files, String path) {
        for (int i = 0; i < files.size(); i++) {
            ProjectFile file = files.get(i);
            if (file.getPath().equals(path)) {
                files.remove(i);
                return true;
            } else if ("folder".equals(file.getType()) && deleteEntryByPath(file.getChildren(), path)) {
                return true;
            }
        }
        return false;
    }

    private boolean isOwner(Project project, String githubId) {
        return project.getOwner().equals(githubId);
    }

    private boolean isOwnerOrCollaborator(Project project, String githubId) {
        return isOwner(project, githubId) || project.getCollaborators().contains(githubId);
    }
}
