package com.collab.editor.collaborative_code_editor.controller;

import com.collab.editor.collaborative_code_editor.model.WebSocketResponse;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketController {

    @MessageMapping("/sendMessage")
    @SendTo("/topic/messages")
    public WebSocketResponse handleMessage(String message) {
        return new WebSocketResponse("Server response: " + message);
    }

}