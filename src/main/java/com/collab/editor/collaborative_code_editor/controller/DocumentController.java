package com.collab.editor.collaborative_code_editor.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class DocumentController {

    @MessageMapping("/edit")
    @SendTo("/topic/document")
    public String updateDocument(String newContent) {
        return newContent; // Broadcast updated content to all subscribers
    }
}
