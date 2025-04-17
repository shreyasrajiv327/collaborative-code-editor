package com.collaborative_code_editor.service;

import com.collaborative_code_editor.model.ChatMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.util.*;
//import java.util.List;

@Service
public class ChatService {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public void addChatMessage(String projectId, ChatMessage message) {
        try {
            String messageJson = objectMapper.writeValueAsString(message);
            String key = "chat:" + projectId;
            redisTemplate.opsForList().rightPush(key, messageJson);
            redisTemplate.opsForList().trim(key, -100, -1); // Keep last 100 messages
            redisTemplate.expire(key, Duration.ofHours(1));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public List<ChatMessage> getChatMessages(String projectId) {
        String key = "chat:" + projectId;
        List<String> rawMessages = redisTemplate.opsForList().range(key, -100, -1); // Fetch last 100
        List<ChatMessage> messages = new ArrayList<>(Math.min(rawMessages.size(), 100));
        for (String msg : rawMessages) {
            try {
                messages.add(objectMapper.readValue(msg, ChatMessage.class));
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return messages;
    }

    public void userStartedTyping(String projectId, String userId) {
        String key = "typing:" + projectId;
        redisTemplate.opsForSet().add(key, userId);
        redisTemplate.expire(key, Duration.ofSeconds(10));
    }

    public void userStoppedTyping(String projectId, String userId) {
        String key = "typing:" + projectId;
        redisTemplate.opsForSet().remove(key, userId);
    }

    public Set<String> getTypingUsers(String projectId) {
        String key = "typing:" + projectId;
        return redisTemplate.opsForSet().members(key);
    }
}


//package com.collaborative_code_editor.service;
//
//import com.collaborative_code_editor.model.ChatMessage;
//import com.fasterxml.jackson.databind.ObjectMapper;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.data.redis.core.RedisTemplate;
//import org.springframework.stereotype.Service;
//import java.time.Duration;
//import java.util.*;
////import java.util.List;
//
//@Service
//public class ChatService {
//
//    @Autowired
//    private RedisTemplate<String, String> redisTemplate;
//
//    private final ObjectMapper objectMapper = new ObjectMapper();
//
//    public void addChatMessage(String projectId, ChatMessage message) {
//        try {
//            String messageJson = objectMapper.writeValueAsString(message);
//            String key = "chat:" + projectId;
//            redisTemplate.opsForList().rightPush(key, messageJson);
//            redisTemplate.opsForList().trim(key, -100, -1); // Keep last 100 messages
//            redisTemplate.expire(key, Duration.ofHours(1));
//        } catch (Exception e) {
//            e.printStackTrace();
//        }
//    }
//
//    public List<ChatMessage> getChatMessages(String projectId) {
//        String key = "chat:" + projectId;
//        List<String> rawMessages = redisTemplate.opsForList().range(key, -100, -1); // Fetch last 100
//        List<ChatMessage> messages = new ArrayList<>(Math.min(rawMessages.size(), 100));
//        for (String msg : rawMessages) {
//            try {
//                messages.add(objectMapper.readValue(msg, ChatMessage.class));
//            } catch (Exception e) {
//                e.printStackTrace();
//            }
//        }
//        return messages;
//    }
//
//    public void userStartedTyping(String projectId, String userId) {
//        String key = "typing:" + projectId;
//        redisTemplate.opsForSet().add(key, userId);
//        redisTemplate.expire(key, Duration.ofSeconds(10));
//    }
//
//    public void userStoppedTyping(String projectId, String userId) {
//        String key = "typing:" + projectId;
//        redisTemplate.opsForSet().remove(key, userId);
//    }
//
//    public Set<String> getTypingUsers(String projectId) {
//        String key = "typing:" + projectId;
//        return redisTemplate.opsForSet().members(key);
//    }
//}