package com.collaborative_code_editor.controller;

import com.collaborative_code_editor.model.ExecutionRequest;
import com.collaborative_code_editor.service.ExecutionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/execute")
public class ExecutionController {

    private final ExecutionService executionService;

    @Autowired
    public ExecutionController(ExecutionService executionService) {
        this.executionService = executionService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> executeCode(@RequestBody ExecutionRequest request) {
        System.out.println("Received code: " + request.getCode());
        System.out.println("Received language: " + request.getLanguage());
        System.out.println("Received input: " + request.getInput());

        try {
            Map<String, Object> result = executionService.execute(request);
            return ResponseEntity.ok(result);
        } catch (JsonProcessingException e) {
            return ResponseEntity.status(500).body(Map.of("error", "Error processing JSON: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "An unexpected error occurred: " + e.getMessage()));
        }
    }
}