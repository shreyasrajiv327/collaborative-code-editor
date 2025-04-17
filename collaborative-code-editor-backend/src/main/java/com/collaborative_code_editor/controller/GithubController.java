package com.collaborative_code_editor.controller;

import com.collaborative_code_editor.model.User;
import com.collaborative_code_editor.service.GithubService;
import com.collaborative_code_editor.service.ProjectService;
import com.collaborative_code_editor.model.CommitRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/github")
@RequiredArgsConstructor
public class GithubController {

    private final GithubService gitHubService;
    private final ProjectService projectService;

    @PostMapping("/create-repo")
    public ResponseEntity<String> createRepo(@RequestAttribute(value = "githubAccessToken") String githubAccessToken,
                                             @RequestParam String name,
                                             @RequestParam String description,
                                             @RequestParam String language,
                                             @RequestParam List<String> collaboratorUsernames,
                                             @AuthenticationPrincipal User currentUser) {
        System.out.println("********GITHUB ACCESS TOKEN***********:" + githubAccessToken);
        System.out.println("currentUser:" + currentUser);
        if (githubAccessToken == null || githubAccessToken.isBlank()) {
            return ResponseEntity.status(401).body("Invalid or expired token");
        }

        gitHubService.createRepo(currentUser, githubAccessToken, name, description, language, collaboratorUsernames);

        return ResponseEntity.ok("Repo created successfully!");
    }

    @PostMapping("/add-collaborator")
    public ResponseEntity<String> addCollaborator(@RequestAttribute("githubAccessToken") String githubAccessToken,
                                                  @RequestParam String repoName,
                                                  @RequestParam String collaboratorUsername,
                                                  @AuthenticationPrincipal User currentUser) {
        if (githubAccessToken == null || githubAccessToken.isBlank()) {
            return ResponseEntity.status(401).body("Invalid or expired token");
        }

        try {
            // Construct GitHub API repo URL
            String checkRepoUrl = "https://api.github.com/repos/" + currentUser.getGithubLogin() + "/" + repoName;
            gitHubService.addCollaboratorToRepo(currentUser, githubAccessToken, checkRepoUrl, collaboratorUsername);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("❌ Failed to add collaborator to GitHub: " + e.getMessage());
        }

        try {
            projectService.addCollaboratorToProject(repoName, collaboratorUsername);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("❌ Collaborator added to GitHub, but failed to update MongoDB: " + e.getMessage());
        }

        return ResponseEntity.ok("✅ Collaborator added to GitHub and project updated successfully");
    }

    @PostMapping("/remove-collaborator")
    public ResponseEntity<String> removeCollaborator(@RequestAttribute("githubAccessToken") String githubAccessToken,
                                                     @RequestParam String repoUrl,
                                                     @RequestParam String collaboratorUsername,
                                                     @RequestParam String projectName,
                                                     @AuthenticationPrincipal User currentUser) {
        if (githubAccessToken == null || githubAccessToken.isBlank()) {
            return ResponseEntity.status(401).body("Invalid or expired token");
        }

        try {
            gitHubService.removeCollaboratorFromRepo(currentUser, githubAccessToken, repoUrl, collaboratorUsername);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Failed to remove collaborator from GitHub");
        }

        try {
            projectService.removeCollaboratorFromProject(projectName, collaboratorUsername);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Failed to update project in MongoDB");
        }

        return ResponseEntity.ok("Collaborator removed from GitHub and project updated");
    }

    @PostMapping("/commit")
    public ResponseEntity<String> commit(@RequestAttribute("githubAccessToken") String githubAccessToken,
                                         @RequestBody CommitRequest commitRequest,
                                         @AuthenticationPrincipal User currentUser) {

        if (githubAccessToken == null || githubAccessToken.isBlank()) {
            return ResponseEntity.status(401).body("Invalid or expired token");
        }

        gitHubService.commitToRepo(
                githubAccessToken,
                commitRequest.getOwner(),
                commitRequest.getRepo(),
                commitRequest.getFilesWithPaths(),
                commitRequest.getCommitMessage()
        );
        return ResponseEntity.ok("✅ Commit successful.");

    }

    @GetMapping("/files")
    public ResponseEntity<Map<String, String>> getRepoFiles(@RequestAttribute("githubAccessToken") String githubAccessToken,
                                                            @RequestParam String owner,
                                                            @RequestParam String repo,
                                                            @RequestParam(defaultValue = "main") String branch,
                                                            @AuthenticationPrincipal User currentUser) {
        Map<String, String> filesWithContent = gitHubService.getRepoContents(githubAccessToken, owner, repo, branch);
        return ResponseEntity.ok(filesWithContent);
    }

}

