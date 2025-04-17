package com.collaborative_code_editor.service;

import com.collaborative_code_editor.model.ExecutionLog;
import com.collaborative_code_editor.model.ExecutionRequest;
import com.collaborative_code_editor.repository.ExecutionLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class ExecutionService {

    private final String API_URL = "https://judge0-ce.p.rapidapi.com/submissions";
    private final String RAPIDAPI_KEY = "cd702e026fmsh0e0e31055652f87p16bc5bjsn2cc13a110191"; // Replace in prod
    private final String RAPIDAPI_HOST = "judge0-ce.p.rapidapi.com";

    @Autowired
    private ExecutionLogRepository executionLogRepository;

//    public Map<String, Object> execute(ExecutionRequest request) throws JsonProcessingException {
//        String sourceCode = request.getCode();
//        String language = request.getLanguage();
//        String input = request.getInput();
//
//        if (sourceCode == null || sourceCode.isBlank()) {
//            throw new IllegalArgumentException("Code cannot be empty");
//        }
//
//        int languageId = getLanguageId(language);
//        if (languageId == -1) {
//            throw new IllegalArgumentException("Unsupported or unknown language: " + language);
//        }
//
//        // Prepare request
//        RestTemplate restTemplate = new RestTemplate();
//        ObjectMapper objectMapper = new ObjectMapper();
//
//        HttpHeaders headers = new HttpHeaders();
//        headers.setContentType(MediaType.APPLICATION_JSON);
//        headers.set("X-RapidAPI-Key", RAPIDAPI_KEY);
//        headers.set("X-RapidAPI-Host", RAPIDAPI_HOST);
//
//        Map<String, Object> payload = new HashMap<>();
//        payload.put("language_id", languageId);
//        payload.put("source_code", sourceCode);
//        if (input != null && !input.isBlank()) {
//            payload.put("stdin", input);
//        }
//
//        String jsonPayload = objectMapper.writeValueAsString(payload);
//        HttpEntity<String> entity = new HttpEntity<>(jsonPayload, headers);
//
//        // Record start time
//        Instant startTime = Instant.now();
//
//        // POST: Send code to execute and get token
//        ResponseEntity<String> response = restTemplate.exchange(
//                API_URL + "?base64_encoded=false&wait=false&fields=*",
//                HttpMethod.POST,
//                entity,
//                String.class
//        );
//
//        if (!response.getStatusCode().is2xxSuccessful()) {
//            throw new RuntimeException("Execution failed: " + response.getStatusCode() + " - " + response.getBody());
//        }
//
//        JsonNode root = objectMapper.readTree(response.getBody());
//        String token = root.get("token").asText();
//
//        // GET: Get the result using token
//        Map<String, Object> result = getSubmissionResult(token);
//
//        // Record end time
//        Instant endTime = Instant.now();
//
//        // Save execution log
//        ExecutionLog log = new ExecutionLog();
//        log.setProjectId(request.getProjectId());
//        log.setExecutedBy(request.getExecutedBy());
//        log.setFilePath(request.getFilePath());
//        log.setSourceCode(sourceCode);
//        log.setLanguageId(languageId);
//        log.setStdout((String) result.get("stdout"));
//        log.setStderr((String) result.get("stderr"));
//        log.setExitCode((Integer) result.get("exit_code"));
//        log.setStatus(((Map<String, Object>) result.get("status")).get("description").toString());
//        log.setCreatedAt(startTime);
//        log.setFinishedAt(endTime);
//
//        // Optional parsing safeguards
//        try {
//            log.setTime(Double.parseDouble(result.get("time").toString()));
//        } catch (Exception e) {
//            log.setTime(0.0);
//        }
//
//        try {
//            log.setMemory((Integer) result.get("memory"));
//        } catch (Exception e) {
//            log.setMemory(0);
//        }
//
//        executionLogRepository.save(log);
//
//        return result; // Return the Map directly
//    }

    public Map<String, Object> execute(ExecutionRequest request) throws JsonProcessingException {
        String sourceCode = request.getCode();
        String language = request.getLanguage();
        String input = request.getInput();

        if (sourceCode == null || sourceCode.isBlank()) {
            throw new IllegalArgumentException("Code cannot be empty");
        }

        int languageId = getLanguageId(language);
        if (languageId == -1) {
            throw new IllegalArgumentException("Unsupported or unknown language: " + language);
        }

        // Prepare request
        RestTemplate restTemplate = new RestTemplate();
        ObjectMapper objectMapper = new ObjectMapper();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-RapidAPI-Key", RAPIDAPI_KEY);
        headers.set("X-RapidAPI-Host", RAPIDAPI_HOST);

        Map<String, Object> payload = new HashMap<>();
        payload.put("language_id", languageId);
        payload.put("source_code", sourceCode);
        if (input != null && !input.isBlank()) {
            payload.put("stdin", input);
        }

        String jsonPayload = objectMapper.writeValueAsString(payload);
        HttpEntity<String> entity = new HttpEntity<>(jsonPayload, headers);

        // Record start time
        Instant startTime = Instant.now();

        // POST: Send code to execute and get token
        ResponseEntity<String> response = restTemplate.exchange(
                API_URL + "?base64_encoded=false&wait=false&fields=*",
                HttpMethod.POST,
                entity,
                String.class
        );

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Execution failed: " + response.getStatusCode() + " - " + response.getBody());
        }

        JsonNode root = objectMapper.readTree(response.getBody());
        String token = root.get("token").asText();

        // GET: Get the result using token
        Map<String, Object> result = getSubmissionResult(token);

        // Record end time
        Instant endTime = Instant.now();

        // Save execution log
        ExecutionLog log = new ExecutionLog();
        log.setProjectId(request.getProjectId());
        log.setExecutedBy(request.getExecutedBy());
        log.setFilePath(request.getFilePath());
        log.setSourceCode(sourceCode);
        log.setLanguageId(languageId);

        // Safely set stdout
        log.setStdout((String) result.getOrDefault("stdout", ""));

        // Safely set stderr
        log.setStderr((String) result.getOrDefault("stderr", ""));

        // Set exit code with null check
        Object exitCodeObj = result.get("exit_code");
        if (exitCodeObj instanceof Integer) {
            log.setExitCode((Integer) exitCodeObj);
        } else {
            log.setExitCode(-1); // Default error exit code
        }

        // Set status safely
        Object statusObj = result.get("status");
        if (statusObj instanceof Map statusMap && statusMap.get("description") != null) {
            log.setStatus(statusMap.get("description").toString());
        } else {
            log.setStatus("Unknown");
        }

        // Set time safely with fallback
        try {
            log.setTime(Double.parseDouble(result.get("time").toString()));
        } catch (Exception e) {
            log.setTime(0.0); // Default value if time parsing fails
        }

        // Set memory safely with fallback
        try {
            Object memoryObj = result.get("memory");
            log.setMemory((memoryObj instanceof Integer) ? (Integer) memoryObj : 0);
        } catch (Exception e) {
            log.setMemory(0); // Default value if memory parsing fails
        }

        // Save execution log
        executionLogRepository.save(log);

        return result; // Return the Map directly
    }

    // Get result from Judge0 using token
    private Map<String, Object> getSubmissionResult(String token) {
        RestTemplate restTemplate = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-RapidAPI-Key", RAPIDAPI_KEY);
        headers.set("X-RapidAPI-Host", RAPIDAPI_HOST);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        Map<String, Object> result = null;
        int maxAttempts = 10;
        int attempt = 0;

        while (attempt < maxAttempts) {
            ResponseEntity<Map> response = restTemplate.exchange(
                    API_URL + "/" + token + "?base64_encoded=false&fields=*",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                result = response.getBody();
                if (result != null) {
                    Map<String, Object> status = (Map<String, Object>) result.get("status");
                    if (status != null) {
                        int statusId = (Integer) status.get("id");
                        // Status ID 1 = In Queue, 2 = Processing, 3+ = Done/Other
                        if (statusId > 2) {
                            return result;
                        }
                    }
                }
            }

            attempt++;
            try {
                Thread.sleep(500); // Wait 0.5 seconds before polling again
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        throw new RuntimeException("Execution result not ready after polling.");
    }

    // Map user-friendly language name to Judge0 language_id
    private int getLanguageId(String language) {
        return switch (language.toLowerCase()) {
            case "python", "python3" -> 71;
            case "cpp", "c++" -> 54;
            case "c" -> 50;
            case "java" -> 62;
            case "javascript", "js" -> 63;
            case "go", "golang" -> 60;
            case "csharp", "c#" -> 51;
            case "ruby" -> 72;
            case "swift" -> 83;
            case "typescript", "ts" -> 74;
            default -> -1;
        };
    }
}