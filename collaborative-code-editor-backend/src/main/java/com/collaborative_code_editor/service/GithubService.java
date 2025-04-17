package com.collaborative_code_editor.service;

import com.collaborative_code_editor.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import java.util.*;
import java.util.Base64;
import java.io.IOException;

@Service
public class GithubService {

    private static final Logger logger = LoggerFactory.getLogger(GithubService.class);
    private final RestTemplate restTemplate;
    private final ProjectService projectService; // Inject ProjectService to store project details after repo creation

    // Constructor injection for RestTemplate and ProjectService
    @Autowired
    public GithubService(RestTemplate restTemplate, ProjectService projectService) {
        this.restTemplate = restTemplate;
        this.projectService = projectService;
    }


    public void createRepo(User currentUser, String accessToken, String repoName, String description, String language, List<String> collaboratorUsernames) {
        String url = "https://api.github.com/user/repos";

        // Get GitHub username
        String username = currentUser.getGithubLogin();
        if (username == null || username.isBlank()) {
            logger.error("GitHub username is not available for user: {}", currentUser);
            throw new IllegalArgumentException("GitHub username is not available for the current user.");
        }
        logger.info("username: {}", username);

        // Construct the repo URL without placeholders
        String checkRepoUrl = "https://api.github.com/repos/" + username + "/" + repoName;

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-GitHub-Api-Version", "2022-11-28");

        HttpEntity<String> request = new HttpEntity<>(headers);

        try {
            // Check if the repo already exists
            ResponseEntity<String> response = restTemplate.exchange(checkRepoUrl, HttpMethod.GET, request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                logger.warn("Repository already exists: {}", repoName);
                throw new RuntimeException("Repository with the same name already exists on GitHub.");
            }
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                // Repository does not exist, proceed with creation
                Map<String, Object> body = new HashMap<>();
                body.put("name", repoName);
                body.put("description", description);
                body.put("private", false);
                body.put("auto_init", true);

                HttpEntity<Map<String, Object>> requestBody = new HttpEntity<>(body, headers);
                ResponseEntity<String> createResponse = restTemplate.postForEntity(url, requestBody, String.class);

                if (createResponse.getStatusCode().is2xxSuccessful()) {
                    logger.info("✅ Repository created successfully: {}", repoName);

                    // Add collaborators to the repository
                    if (collaboratorUsernames != null && !collaboratorUsernames.isEmpty()) {
                        for (String collaboratorUsername : collaboratorUsernames) {
                            addCollaboratorToRepo(currentUser, accessToken, checkRepoUrl, collaboratorUsername);
                        }
                    } else {
                        logger.info("No collaborators provided for repo: {}", repoName);
                    }

                    // Store repo details in MongoDB
                    projectService.storeRepoDetails(repoName, description, language, collaboratorUsernames);
                } else {
                    logger.error("Failed to create repo: {}", createResponse.getBody());
                    throw new RuntimeException("Failed to create repository on GitHub.");
                }
            } else {
                logger.error("Error checking repo existence: {}", e.getMessage());
                throw new RuntimeException("Failed to check repository existence: " + e.getMessage());
            }
        }
    }

    public void addCollaboratorToRepo(User currentUser, String accessToken, String repoUrl, String collaboratorUsername) {
        if (collaboratorUsername == null || collaboratorUsername.isBlank()) {
            logger.error("Collaborator username is null or empty");
            throw new IllegalArgumentException("Collaborator username cannot be null or empty.");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headers.set("X-GitHub-Api-Version", "2022-11-28");

        // Ensure repoUrl is clean
        String cleanRepoUrl = repoUrl.endsWith("/") ? repoUrl.substring(0, repoUrl.length() - 1) : repoUrl;
        String url = cleanRepoUrl + "/collaborators/" + collaboratorUsername;

        logger.debug("Adding collaborator to URL: {}", url);

        // GitHub API requires an empty JSON body for adding collaborators
        HttpEntity<String> request = new HttpEntity<>("{}", headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, request, String.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                logger.error("Failed to add collaborator: {}, response: {}", collaboratorUsername, response.getBody());
                throw new RuntimeException("Failed to add collaborator to GitHub: " + response.getBody());
            }

            logger.info("✅ Collaborator added: {}", collaboratorUsername);
        } catch (HttpClientErrorException e) {
            logger.error("Error adding collaborator: {}, status: {}, message: {}", collaboratorUsername, e.getStatusCode(), e.getMessage());
            throw new RuntimeException("Failed to add collaborator to GitHub: " + e.getMessage());
        }
    }


    public void removeCollaboratorFromRepo(User currentUser, String accessToken, String repoUrl, String collaboratorUsername) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        String[] parts = repoUrl.split("/");
        String owner = currentUser.getGithubLogin();
//        String owner = parts[parts.length - 2];
        String repo = parts[parts.length - 1];

        String url = "https://api.github.com/repos/" + owner + "/" + repo + "/collaborators/" + collaboratorUsername;
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(headers), String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Failed to remove collaborator from GitHub: " + response.getBody());
        }

        System.out.println("✅ Collaborator removed: " + collaboratorUsername);
    }


    public void commitToRepo(String accessToken, String owner, String repo, Map<String, String> filesWithPaths, String commitMessage) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Accept", "application/vnd.github.v3+json"); // GitHub API version

        try {
            // 1. Get the latest commit SHA
            String refUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/git/ref/heads/main";
            ResponseEntity<Map> refResponse = restTemplate.exchange(refUrl, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            String latestCommitSha = ((Map) refResponse.getBody().get("object")).get("sha").toString();

            // 2. Get the tree SHA
            String commitUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/git/commits/" + latestCommitSha;
            ResponseEntity<Map> commitResponse = restTemplate.exchange(commitUrl, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            String baseTreeSha = (String) ((Map) commitResponse.getBody().get("tree")).get("sha");

            // 3. Create the files in the repo by iterating through the file paths and contents
            List<Map<String, Object>> treeEntries = new ArrayList<>();
            for (Map.Entry<String, String> entry : filesWithPaths.entrySet()) {
                String filePath = entry.getKey();
                String content = entry.getValue();

                // Ensure proper encoding
                String encodedContent = encodeContent(content);

                // 4. Create a new blob for each file
                String blobUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/git/blobs";
                Map<String, Object> blobBody = Map.of(
                        "content", encodedContent,
                        "encoding", "base64" // Set encoding to base64 if content is binary
                );
                ResponseEntity<Map> blobResponse = restTemplate.postForEntity(blobUrl, new HttpEntity<>(blobBody, headers), Map.class);
                String blobSha = blobResponse.getBody().get("sha").toString();

                // 5. Create a tree entry for each file
                Map<String, Object> treeEntry = Map.of(
                        "path", filePath,
                        "mode", "100644", // Regular file mode
                        "type", "blob",
                        "sha", blobSha
                );
                treeEntries.add(treeEntry);
            }

            // 6. Create a new tree with all the file entries
            String treeUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/git/trees";
            Map<String, Object> treeBody = Map.of(
                    "base_tree", baseTreeSha,
                    "tree", treeEntries
            );
            ResponseEntity<Map> treeResponse = restTemplate.postForEntity(treeUrl, new HttpEntity<>(treeBody, headers), Map.class);
            String newTreeSha = treeResponse.getBody().get("sha").toString();

            // 7. Create a new commit with the new tree
            String newCommitUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/git/commits";
            Map<String, Object> commitBody = Map.of(
                    "message", commitMessage,
                    "tree", newTreeSha,
                    "parents", List.of(latestCommitSha)
            );
            ResponseEntity<Map> newCommitResponse = restTemplate.postForEntity(newCommitUrl, new HttpEntity<>(commitBody, headers), Map.class);
            String newCommitSha = newCommitResponse.getBody().get("sha").toString();

            // 8. Update the reference to point to the new commit
            String updateRefUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/git/refs/heads/main";
            Map<String, Object> updateRefBody = Map.of("sha", newCommitSha);
            restTemplate.exchange(updateRefUrl, HttpMethod.PATCH, new HttpEntity<>(updateRefBody, headers), Map.class);

            System.out.println("✅ Commit successful with files and folder structure!");

        } catch (Exception e) {
            System.err.println("Error committing to the repository: " + e.getMessage());
            // Optionally, retry or handle different exceptions (e.g., rate limiting)
        }
    }

    // Helper method to encode content properly (UTF-8 for text, Base64 for binary)
    private String encodeContent(String content) {
        // Check if the content is binary or text (for simplicity, consider it text if not binary)
        try {
            byte[] contentBytes = content.getBytes("UTF-8");
            return Base64.getEncoder().encodeToString(contentBytes); // Base64 encoding
        } catch (Exception e) {
            return content; // Return as-is if unable to encode (for text files)
        }
    }

    public Map<String, String> getRepoContents(String accessToken, String owner, String repo, String branch) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        HttpEntity<String> entity = new HttpEntity<>(headers);

        Map<String, String> filesWithContent = new HashMap<>();

        // Step 1: Get recursive tree
        String treeUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/git/trees/" + branch + "?recursive=1";

        try {
            ResponseEntity<Map> treeResponse = restTemplate.exchange(treeUrl, HttpMethod.GET, entity, Map.class);
            List<Map<String, Object>> tree = (List<Map<String, Object>>) treeResponse.getBody().get("tree");

            for (Map<String, Object> file : tree) {
                if ("blob".equals(file.get("type"))) {
                    String path = file.get("path").toString();

                    // Step 2: Fetch file content
                    String contentUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
                    ResponseEntity<Map> contentResponse = restTemplate.exchange(contentUrl, HttpMethod.GET, entity, Map.class);

                    if (contentResponse.getStatusCode().is2xxSuccessful()) {
                        Map<String, Object> contentMap = contentResponse.getBody();
                        String encodedContent = contentMap.get("content").toString();
                        String decodedContent = new String(Base64.getDecoder().decode(encodedContent.replaceAll("\\s", "")));
                        filesWithContent.put(path, decodedContent);
                    }
                }
            }

        } catch (Exception e) {
            System.err.println("❌ Error fetching repo contents: " + e.getMessage());
        }

        return filesWithContent;
    }


}

//public void addCollaboratorToRepo(User currentUser, String accessToken, String repoUrl, String collaboratorUsername) {
//        HttpHeaders headers = new HttpHeaders();
//        headers.setBearerAuth(accessToken);
//        headers.setContentType(MediaType.APPLICATION_JSON);
//
//        String[] parts = repoUrl.split("/");
//        String owner = currentUser.getGithubLogin();
//        String owner = parts[parts.length - 2];
//        String repo = parts[parts.length - 1];
//
//        String url = "https://api.github.com/repos/" + owner + "/" + repo + "/collaborators/" + collaboratorUsername;
//        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, new HttpEntity<>(headers), String.class);
//
//        if (!response.getStatusCode().is2xxSuccessful()) {
//            throw new RuntimeException("Failed to add collaborator to GitHub: " + response.getBody());
//        }
//
//        System.out.println("✅ Collaborator added: " + collaboratorUsername);
//    }