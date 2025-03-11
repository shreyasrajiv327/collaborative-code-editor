package com.collab.editor.collaborative_code_editor.controller;

import com.collab.editor.collaborative_code_editor.model.ExecutionRequest;
import com.collab.editor.collaborative_code_editor.service.Judge0Client;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/api/code")
public class ExecutionController {

    private final Judge0Client judge0Client;

    public ExecutionController(Judge0Client judge0Client) {
        this.judge0Client = judge0Client;
    }

    @PostMapping
    public String executeCode(@RequestBody ExecutionRequest request) {
        System.out.println("Received execution request: " + request.getSourceCode());
        return judge0Client.submitCode(request.getSourceCode(), request.getLanguageId(), request.getStdin());
    }

}
