package com.collaborative_code_editor.websocket;

import com.collaborative_code_editor.model.ChatMessage;
import com.collaborative_code_editor.service.ChatService;
import com.collaborative_code_editor.service.RedisService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
public class CollaborationHandler {

    private final SimpMessagingTemplate messagingTemplate;
    private final RedisService redisService;
    private final ChatService chatService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CollaborationHandler(SimpMessagingTemplate messagingTemplate, RedisService redisService, ChatService chatService) {
        this.messagingTemplate = messagingTemplate;
        this.redisService = redisService;
        this.chatService = chatService;
    }

    @MessageMapping("/edit/{projectId}/{filePath}")
    public void handleEdit(
            @DestinationVariable String projectId,
            @DestinationVariable String filePath,
            @Payload String payload) {
        try {
            JsonNode json = objectMapper.readTree(payload);
            String userId = json.get("userId").asText();
            String cursor = json.get("cursor").toString();
            String tempCode = json.has("tempCode") ? json.get("tempCode").asText() : "";

            redisService.storeCurrentCode(projectId, filePath, tempCode);
        } catch (Exception e) {
            e.printStackTrace();
        }

        messagingTemplate.convertAndSend("/topic/session/" + projectId + "/" + filePath, payload);
    }

    @MessageMapping("/join/{projectId}/{filePath}")
    @SendTo("/topic/session/{projectId}/{filePath}")
    public Map<String, Object> handleJoin(
            @DestinationVariable String projectId,
            @DestinationVariable String filePath) {
        String currentCode = redisService.getCurrentCode(projectId, filePath);
        List<ChatMessage> chatMessages = chatService.getChatMessages(projectId);

        Map<String, Object> sessionData = new HashMap<>();
        sessionData.put("currentCode", currentCode);
        sessionData.put("chatMessages", chatMessages);
        return sessionData;
    }
    @MessageMapping("/joinChat/{projectId}")
    @SendTo("/topic/sessionChat/{projectId}")
    public Map<String, Object> handleChatJoin(
            @DestinationVariable String projectId) {
        List<ChatMessage> chatMessages = chatService.getChatMessages(projectId);

        Map<String, Object> sessionData = new HashMap<>();
        sessionData.put("chatMessages", chatMessages);
        return sessionData;
    }
}

//package com.collaborative_code_editor.websocket;
//
//import com.collaborative_code_editor.model.ChatMessage;
//import com.collaborative_code_editor.service.ChatService;
//import com.collaborative_code_editor.service.RedisService;
//import com.fasterxml.jackson.databind.JsonNode;
//import com.fasterxml.jackson.databind.ObjectMapper;
//import org.springframework.messaging.handler.annotation.*;
//import org.springframework.messaging.simp.SimpMessagingTemplate;
//import org.springframework.stereotype.Controller;
//
//import java.util.HashMap;
//import java.util.List;
//import java.util.Map;
//
//@Controller
//public class CollaborationHandler {
//
//    private final SimpMessagingTemplate messagingTemplate;
//    private final RedisService redisService;
//    private final ChatService chatService;
//    private final ObjectMapper objectMapper = new ObjectMapper();
//
//    public CollaborationHandler(SimpMessagingTemplate messagingTemplate, RedisService redisService, ChatService chatService) {
//        this.messagingTemplate = messagingTemplate;
//        this.redisService = redisService;
//        this.chatService = chatService;
//    }
//
//    @MessageMapping("/edit/{projectId}/{filePath}")
//    public void handleEdit(
//            @DestinationVariable String projectId,
//            @DestinationVariable String filePath,
//            @Payload String payload) {
//        try {
//            JsonNode json = objectMapper.readTree(payload);
//            String userId = json.get("userId").asText();
//            String cursor = json.get("cursor").toString();
//            String tempCode = json.has("tempCode") ? json.get("tempCode").asText() : "";
//
//            redisService.storeCurrentCode(projectId, filePath, tempCode);
//        } catch (Exception e) {
//            e.printStackTrace();
//        }
//
//        messagingTemplate.convertAndSend("/topic/session/" + projectId + "/" + filePath, payload);
//    }
//
//    @MessageMapping("/join/{projectId}/{filePath}")
//    @SendTo("/topic/session/{projectId}/{filePath}")
//    public Map<String, Object> handleJoin(
//            @DestinationVariable String projectId,
//            @DestinationVariable String filePath) {
//        String currentCode = redisService.getCurrentCode(projectId, filePath);
//        List<ChatMessage> chatMessages = chatService.getChatMessages(projectId, filePath);
//
//        Map<String, Object> sessionData = new HashMap<>();
//        sessionData.put("currentCode", currentCode);
//        sessionData.put("chatMessages", chatMessages);
//        return sessionData;
//    }
//
//}