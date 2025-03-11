package com.collab.editor.collaborative_code_editor.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import com.collab.editor.collaborative_code_editor.service.Judge0Client;
import com.collab.editor.collaborative_code_editor.model.UserMessage;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@Controller
public class EditorController {
    private final Judge0Client judge0Client;
    private final Set<String> activeUsers = new CopyOnWriteArraySet<>();
    private String currentCode = "// Start coding...";

    public EditorController(Judge0Client judge0Client) { // ✅ Inject Judge0Client
        this.judge0Client = judge0Client;
    }

    @MessageMapping("/code")
    @SendTo("/topic/updates")
    public String handleCodeUpdate(String code) {
        return code;
    }

    @MessageMapping("/join")
    @SendTo("/topic/users")
    public Set<String> addUser(UserMessage userMessage) {
        activeUsers.add(userMessage.getName());
        return activeUsers;
    }

    @MessageMapping("/leave")
    @SendTo("/topic/users")
    public Set<String> removeUser(UserMessage userMessage) {
        activeUsers.remove(userMessage.getName());
        return activeUsers;
    }

    @MessageMapping("/run")
    @SendTo("/topic/output")
    public String runCode(String code) {
        System.out.println("Executing code: " + code);
        return judge0Client.submitCode(code, 100, ""); // Default Python
    }
}

