package com.collaborative_code_editor.controller;

import com.collaborative_code_editor.model.ChatMessage;
import com.collaborative_code_editor.model.CollaborationMessage;
import com.collaborative_code_editor.model.TypingStatus;
import com.collaborative_code_editor.model.WebSocketClient;
import com.collaborative_code_editor.service.ChatService;
import com.collaborative_code_editor.service.RedisService;
import com.collaborative_code_editor.service.SessionTrackerService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

@Controller
public class WebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatService chatService;
    private final RedisService redisService;
    private final SessionTrackerService sessionTracker;

    public WebSocketController(SimpMessagingTemplate messagingTemplate, ChatService chatService, RedisService redisService, SessionTrackerService sessionTracker) {
        this.messagingTemplate = messagingTemplate;
        this.chatService = chatService;
        this.redisService = redisService;
        this.sessionTracker = sessionTracker;
    }

    @MessageMapping("/join/{projectId}/")
    @SendTo("/topic/session/{projectId}")
    public String handleUserJoin(
            @DestinationVariable String projectId,
            @Payload String userId,
            SimpMessageHeaderAccessor headerAccessor) {
        String socketId = headerAccessor.getSessionId();
        redisService.addWebSocketClient(socketId, userId, projectId);
        sessionTracker.addUser(projectId, userId);
        String message = "User " + userId + " has joined the project workspace.";
        return message;
    }

    @MessageMapping("/requestCode/{projectId}/{filePath}")
    @SendTo("/topic/collaboration/{projectId}/{filePath}")
    public CollaborationMessage handleCodeRequest(@DestinationVariable String projectId,
                                                  @DestinationVariable String filePath,
                                                  @Payload Map<String, String> payload) {
        String currentCode = redisService.getCurrentCode(projectId, filePath);
        return new CollaborationMessage(
                projectId + "/" + filePath,
                "system",
                "edit",
                currentCode != null ? currentCode : "",
                System.currentTimeMillis()
        );
    }

    @MessageMapping("/collaborate/{projectId}/{filePath}")
    @SendTo("/topic/collaboration/{projectId}/{filePath}")
    public CollaborationMessage handleCollaboration(@DestinationVariable String projectId,
                                                    @DestinationVariable String filePath,
                                                    @Payload CollaborationMessage message) {
        if ("edit".equals(message.getType())) {
            redisService.storeCurrentCode(projectId, filePath, message.getContent());
        }
        return message;
    }

    @MessageMapping("/chat/{projectId}")
    @SendTo("/topic/chat/{projectId}")
    public ChatMessage sendChatMessage(@DestinationVariable String projectId,
                                       @Payload ChatMessage chatMessage) {
        chatMessage.setTimestamp(System.currentTimeMillis());
        chatService.addChatMessage(projectId, chatMessage);
        return chatMessage;
    }

    @MessageMapping("/typing/{projectId}")
    @SendTo("/topic/typing/{projectId}")
    public TypingStatus handleTyping(@DestinationVariable String projectId,
                                     @Payload TypingStatus status) {
        if (status.isTyping()) {
            chatService.userStartedTyping(projectId, status.getUserId());
        } else {
            chatService.userStoppedTyping(projectId, status.getUserId());
        }
        return status;
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String socketId = event.getSessionId();
        WebSocketClient client = redisService.getWebSocketClient(socketId);
        if (client != null && sessionTracker.isUserActive(client.getProjectId(), client.getUserId())) {
            sessionTracker.removeUser(client.getProjectId(), client.getUserId());
            messagingTemplate.convertAndSend(
                    "/topic/session/" + client.getProjectId(),
                    "User " + client.getUserId() + " has disconnected unexpectedly."
            );
        }
        redisService.removeWebSocketClient(socketId);
    }

    @MessageMapping("/leave/{projectId}/")
    @SendTo("/topic/session/{projectId}/")
    public String handleUserLeave(
            @DestinationVariable String projectId,
            @Payload String userId,
            SimpMessageHeaderAccessor headerAccessor) {

        // Remove user from session
        sessionTracker.removeUser(projectId, userId);
        String socketId = headerAccessor.getSessionId();
        redisService.removeWebSocketClient(socketId);

        // Broadcast leave event
        String message = "User " + userId + " has left the project workspace.";
        return message;
    }
}
