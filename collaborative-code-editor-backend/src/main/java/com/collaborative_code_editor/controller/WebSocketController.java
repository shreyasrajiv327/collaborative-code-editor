package com.collaborative_code_editor.controller;

import com.collaborative_code_editor.model.ChatMessage;
import com.collaborative_code_editor.model.CollaborationMessage;
import com.collaborative_code_editor.model.TypingStatus;
import com.collaborative_code_editor.service.ChatService;
import com.collaborative_code_editor.service.RedisService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

@Controller
public class WebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatService chatService;
    private final RedisService redisService;

    public WebSocketController(SimpMessagingTemplate messagingTemplate, ChatService chatService, RedisService redisService) {
        this.messagingTemplate = messagingTemplate;
        this.chatService = chatService;
        this.redisService = redisService;
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

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String socketId = event.getSessionId();
        redisService.removeWebSocketClient(socketId);
    }
}

//package com.collaborative_code_editor.controller;
//
//import com.collaborative_code_editor.model.CollaborationMessage;
//import com.collaborative_code_editor.model.ChatMessage;
//import com.collaborative_code_editor.model.TypingStatus;
//import com.collaborative_code_editor.service.ChatService;
//import com.collaborative_code_editor.service.RedisService;
//import org.springframework.context.event.EventListener;
//import org.springframework.messaging.handler.annotation.*;
//import org.springframework.messaging.simp.SimpMessagingTemplate;
//import org.springframework.stereotype.Controller;
//import org.springframework.web.socket.messaging.SessionDisconnectEvent;
//
//import java.util.Map;
//
//@Controller
//public class WebSocketController {
//
//    private final SimpMessagingTemplate messagingTemplate;
//    private final ChatService chatService;
//    private final RedisService redisService;
//
//    public WebSocketController(SimpMessagingTemplate messagingTemplate, ChatService chatService, RedisService redisService) {
//        this.messagingTemplate = messagingTemplate;
//        this.chatService = chatService;
//        this.redisService = redisService;
//    }
//
//    // Handle collaboration messages (e.g., keystrokes or code changes)
//    @MessageMapping("/collaborate/{projectId}/{filePath}")
//    @SendTo("/topic/collaboration/{projectId}/{filePath}")
//    public CollaborationMessage handleCollaboration(@DestinationVariable String projectId,
//                                                    @DestinationVariable String filePath,
//                                                    @Payload CollaborationMessage message) {
//        String code = message.getContent();
//        redisService.storeCurrentCode(projectId, filePath, code);
//        return message;
//    }
//
//    // Handle chat messages
//    @MessageMapping("/chat/{projectId}/{filePath}")
//    @SendTo("/topic/chat/{projectId}/{filePath}")
//    public ChatMessage sendChatMessage(@DestinationVariable String projectId,
//                                       @DestinationVariable String filePath,
//                                       @Payload ChatMessage chatMessage) {
//        chatMessage.setTimestamp(System.currentTimeMillis());
//        chatService.addChatMessage(projectId, filePath, chatMessage);
//        return chatMessage;
//    }
//
//    // Handle typing indicators
//    @MessageMapping("/typing/{projectId}/{filePath}")
//    public void handleTyping(@DestinationVariable String projectId,
//                             @DestinationVariable String filePath,
//                             @Payload TypingStatus status) {
//        if (status.isTyping()) {
//            chatService.userStartedTyping(projectId, filePath, status.getUserId());
//        } else {
//            chatService.userStoppedTyping(projectId, filePath, status.getUserId());
//        }
//
//        messagingTemplate.convertAndSend("/topic/typing/" + projectId + "/" + filePath, status);
//    }
//
//    // Send code history on join
//    @MessageMapping("/requestCode/{projectId}/{filePath}")
//    public void handleCodeRequest(@DestinationVariable String projectId,
//                                  @DestinationVariable String filePath,
//                                  @Payload Map<String, String> payload) {
//        String currentCode = redisService.getCurrentCode(projectId, filePath);
//        if (currentCode != null) {
//            CollaborationMessage message = new CollaborationMessage(
//                    projectId + "/" + filePath,
//                    "system",
//                    "edit",
//                    currentCode,
//                    System.currentTimeMillis()
//            );
//            messagingTemplate.convertAndSend("/topic/collaboration/" + projectId + "/" + filePath, message);
//        }
//    }
//
//    // On disconnect, clean up Redis keys (optional if you're tracking socketId)
//    @EventListener
//    public void handleSessionDisconnect(SessionDisconnectEvent event) {
//        String socketId = event.getSessionId();
//        redisService.removeWebSocketClient(socketId); // Optional: only needed if you track by socket ID
//    }
//}
