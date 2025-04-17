// src/components/ChatBox.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import debounce from "lodash/debounce";

const ChatBox = ({ projectId, username }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const stompClient = useRef(null);
  const typingTimeout = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Debounced typing handler
  const sendTypingStatus = useCallback(
    debounce((typing) => {
      if (stompClient.current?.connected) {
        stompClient.current.publish({
          destination: `/app/typing/${projectId}`,
          body: JSON.stringify({ userId: username, typing }),
        });
      }
    }, 500),
    [projectId, username]
  );

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");
    stompClient.current = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("Chat WebSocket connected");

        // Subscribe to chat messages
        stompClient.current.subscribe(`/topic/chat/${projectId}`, (message) => {
          const chatMessage = JSON.parse(message.body);
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((msg) => msg.timestamp === chatMessage.timestamp && msg.userId === chatMessage.userId)) {
              return prev;
            }
            return [...prev, chatMessage].slice(-100); // Keep last 100 messages
          });
        });

        // Subscribe to typing indicators
        stompClient.current.subscribe(`/topic/typing/${projectId}`, (message) => {
          const typingStatus = JSON.parse(message.body);
          setTypingUsers((prev) => {
            if (typingStatus.typing) {
              return prev.includes(typingStatus.userId)
                ? prev
                : [...prev, typingStatus.userId];
            } else {
              return prev.filter((id) => id !== typingStatus.userId);
            }
          });
        });

        // Request chat history
        stompClient.current.publish({
          destination: `/app/joinChat/${projectId}`,
          body: JSON.stringify({ userId: username }),
        });

        // Subscribe to join response
        stompClient.current.subscribe(`/topic/sessionChat/${projectId}`, (message) => {
          const sessionData = JSON.parse(message.body);
          if (sessionData.chatMessages) {
            setMessages(sessionData.chatMessages.slice(-100)); // Limit to 100 messages
          }
        });
      },
      onStompError: (frame) => {
        console.error("Chat STOMP error:", frame);
      },
    });

    stompClient.current.activate();

    return () => {
      if (stompClient.current) {
        stompClient.current.deactivate();
      }
    };
  }, [projectId, username]);

  // Handle sending chat messages
  const sendMessage = () => {
    if (newMessage.trim() && stompClient.current?.connected) {
      const chatMessage = {
        userId: localStorage.getItem("githubLogin"),
        message: newMessage,
        timestamp: Date.now(),
        projectId,
      };
      stompClient.current.publish({
        destination: `/app/chat/${projectId}`,
        body: JSON.stringify(chatMessage),
      });
      setNewMessage("");
      sendTypingStatus(false); // Stop typing
    }
  };

  // Handle typing
  const handleTyping = () => {
    sendTypingStatus(true);

    // Clear previous timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    // Stop typing after 5 seconds
    typingTimeout.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 5000);
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-2">
        {messages.map((msg, index) => (
          <div key={`${msg.userId}-${msg.timestamp}`} className="mb-2">
            <strong>{msg.userId}:</strong> {msg.message}
            <span className="text-xs text-gray-400 ml-2">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicators */}
      {typingUsers.length > 0 && (
        <div className="text-sm text-gray-300 italic p-2">
          {typingUsers.join(", ")} {typingUsers.length > 1 ? "are" : "is"} typing...
        </div>
      )}

      {/* Message Input */}
      <div className="p-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          className="w-full p-2 rounded bg-gray-700 text-white border-none focus:outline-none"
          placeholder="Type a message..."
        />
      </div>
    </div>
  );
};

export default ChatBox;