package com.collaborative_code_editor.service;

import com.collaborative_code_editor.model.ChatMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class RedisService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public void addUserToProject(String projectId, String userId) {
        redisTemplate.opsForSet().add("users:" + projectId, userId);
    }

    public void removeUserFromProject(String projectId, String userId) {
        redisTemplate.opsForSet().remove("users:" + projectId, userId);
    }

    public Set<Object> getProjectUsers(String projectId) {
        return redisTemplate.opsForSet().members("users:" + projectId);
    }

    // Live Collaboration State
    public void updateUserEditingState(String projectId, String userId, String cursor, String tempCode) {
        String key = "collab:project:" + projectId + ":user:" + userId;
        redisTemplate.opsForHash().put(key, "cursor", cursor);
        redisTemplate.opsForHash().put(key, "code", tempCode);
    }

    public Map<Object, Object> getUserEditingState(String projectId, String userId) {
        String key = "collab:project:" + projectId + ":user:" + userId;
        return redisTemplate.opsForHash().entries(key);
    }

    // WebSocket Sessions
    public void addWebSocketClient(String socketId, String userId, String projectId) {
        redisTemplate.opsForSet().add("ws:clients", socketId);
        redisTemplate.opsForHash().put("ws:session:" + socketId, "userId", userId);
        redisTemplate.opsForHash().put("ws:session:" + socketId, "projectId", projectId);
    }

    public void removeWebSocketClient(String socketId) {
        redisTemplate.opsForSet().remove("ws:clients", socketId);
        redisTemplate.delete("ws:session:" + socketId);
    }

    public Map<Object, Object> getClientMetadata(String socketId) {
        return redisTemplate.opsForHash().entries("ws:session:" + socketId);
    }

    public void storeCurrentCode(String projectId, String filePath, String code) {
        String key = "code:" + projectId + ":" + filePath;
        redisTemplate.opsForValue().set(key, code);
        redisTemplate.expire(key, Duration.ofHours(1));
    }

    public String getCurrentCode(String projectId, String filePath) {
        try {
            String key = "code:" + projectId + ":" + filePath;
            return (String) redisTemplate.opsForValue().get(key);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    public void deleteCode(String projectId, String filePath) {
        redisTemplate.delete("code:" + projectId + ":" + filePath);
    }

    public void deleteChatAndTyping(String projectId, String filePath) {
        redisTemplate.delete("chat:" + projectId + ":" + filePath);
        redisTemplate.delete("typing:" + projectId + ":" + filePath);
    }

    // General data persistence
    public void storeData(String key, String value) {
        redisTemplate.opsForValue().set(key, value);
    }

    public String retrieveData(String key) {
        return (String) redisTemplate.opsForValue().get(key);
    }

}

