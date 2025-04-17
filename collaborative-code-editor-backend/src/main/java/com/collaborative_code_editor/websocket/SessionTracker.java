package com.collaborative_code_editor.websocket;

import com.collaborative_code_editor.service.RedisService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionTracker {

    private final Map<String, Set<String>> projectUsers = new ConcurrentHashMap<>();

    @Autowired
    private RedisService redisService;

    // Adds a user to the project session
    public boolean addUser(String projectId, String userId) {
        Set<String> users = projectUsers.computeIfAbsent(projectId, k -> new HashSet<>());
        if (users.add(userId)) {
            redisService.addUserToProject(projectId, userId);  // Store user in Redis
            return true;
        }
        return false;
    }

    // Removes a user from the project session
    public void removeUser(String projectId, String userId, String filePath) {
        Set<String> users = projectUsers.get(projectId);
        if (users != null) {
            users.remove(userId);
            if (users.isEmpty()) {
                projectUsers.remove(projectId);  // If no users are left, remove the project session
                // Clean up Redis data when the last user leaves the project
                redisService.removeWebSocketClient(projectId);  // Optional: if you're using socket ID
                redisService.removeUserFromProject(projectId, userId);  // Just in case
                redisService.deleteCode(projectId, filePath);  // Clean up the code stored in Redis for the project
                redisService.deleteChatAndTyping(projectId, filePath);  // Clean up chat and typing data
            } else {
                redisService.removeUserFromProject(projectId, userId);  // Remove the user from Redis
            }
        }
    }

    // Gets the list of users for a given project
    public Set<String> getUsers(String projectId) {
        return projectUsers.getOrDefault(projectId, Collections.emptySet());
    }
}