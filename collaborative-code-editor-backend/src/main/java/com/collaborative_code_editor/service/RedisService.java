package com.collaborative_code_editor.service;

import com.collaborative_code_editor.model.WebSocketClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
public class RedisService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public void storeUserSession(String githubLogin, Map<String, Object> userDetails, long duration, TimeUnit unit) {
        redisTemplate.opsForValue().set(githubLogin, userDetails, duration, unit);
    }

    public void removeUserSession(String githubLogin) {
        redisTemplate.delete(githubLogin);
    }

    public void addUserToProject(String projectId, String userId) {
        redisTemplate.opsForSet().add("users:" + projectId, userId);
    }

    public void removeUserFromProject(String projectId, String userId) {
        redisTemplate.opsForSet().remove("users:" + projectId, userId);
    }

    public Set<Object> getProjectUsers(String projectId) {
        return redisTemplate.opsForSet().members("users:" + projectId);
    }

    public void removeUserAndCleanUpIfLast(String projectId, String userId) {
        String userKey = "users:" + projectId;
        Long userCount = redisTemplate.opsForSet().size(userKey);

        if (userCount != null && userCount <= 1) {
            // Remove the last user
            redisTemplate.opsForSet().remove(userKey, userId);

            // Clean up related Redis keys
            redisTemplate.delete("chat:" + projectId);
            redisTemplate.delete("typing:" + projectId);

            Set<String> keysToDelete = new HashSet<>();
            keysToDelete.addAll(redisTemplate.keys("code:" + projectId + ":*"));
            if (!keysToDelete.isEmpty()) {
                redisTemplate.delete(keysToDelete);
            }
        } else {
            // Just remove the user
            redisTemplate.opsForSet().remove(userKey, userId);
        }
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

    public WebSocketClient getWebSocketClient(String socketId) {
        Map<Object, Object> metadata = redisTemplate.opsForHash().entries("ws:session:" + socketId);
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        String userId = (String) metadata.get("userId");
        String projectId = (String) metadata.get("projectId");
        if (userId == null || projectId == null) {
            return null;
        }
        return new WebSocketClient(userId, projectId);
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
        redisTemplate.delete("chat:" + projectId);
        redisTemplate.delete("typing:" + projectId);
    }

    // General data persistence
    public void storeData(String key, String value) {
        redisTemplate.opsForValue().set(key, value);
    }

    public String retrieveData(String key) {
        return (String) redisTemplate.opsForValue().get(key);
    }

}

