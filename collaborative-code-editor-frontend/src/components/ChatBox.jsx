import React, { useState, useEffect, useRef, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import debounce from 'lodash/debounce';
import { toast } from 'react-toastify';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

const ChatBox = ({ projectId, username }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const stompClient = useRef(null);
  const typingTimeout = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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

  useEffect(() => {
    const socket = new SockJS('http://localhost:8080/ws');
    stompClient.current = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log('Chat WebSocket connected');

        stompClient.current.subscribe(`/topic/chat/${projectId}`, (message) => {
          try {
            const chatMessage = JSON.parse(message.body);
            setMessages((prev) => {
              if (prev.some((msg) => msg.timestamp === chatMessage.timestamp && msg.userId === chatMessage.userId)) {
                return prev;
              }
              return [...prev, chatMessage].slice(-100);
            });
          } catch (e) {
            console.error('Error parsing chat message:', e);
            toast.error('Failed to load chat message', { position: 'top-right' });
          }
        });

        stompClient.current.subscribe(`/topic/typing/${projectId}`, (message) => {
          try {
            const typingStatus = JSON.parse(message.body);
            setTypingUsers((prev) => {
              if (typingStatus.typing) {
                return prev.includes(typingStatus.userId) ? prev : [...prev, typingStatus.userId];
              } else {
                return prev.filter((id) => id !== typingStatus.userId);
              }
            });
          } catch (e) {
            console.error('Error parsing typing status:', e);
          }
        });

        stompClient.current.publish({
          destination: `/app/joinChat/${projectId}`,
          body: JSON.stringify({ userId: username }),
        });

        stompClient.current.subscribe(`/topic/sessionChat/${projectId}`, (message) => {
          try {
            const sessionData = JSON.parse(message.body);
            if (sessionData.chatMessages) {
              setMessages(sessionData.chatMessages.slice(-100));
            }
          } catch (e) {
            console.error('Error parsing session data:', e);
            toast.error('Failed to load chat history', { position: 'top-right' });
          }
        });
      },
      onStompError: (frame) => {
        console.error('Chat STOMP error:', frame);
        toast.error('Chat connection error. Please try again.', { position: 'top-right' });
      },
      onWebSocketClose: () => {
        console.warn('Chat WebSocket closed');
        toast.warn('Chat connection closed. Reconnecting...', { position: 'top-right' });
      },
    });

    stompClient.current.activate();

    return () => {
      if (stompClient.current) {
        stompClient.current.deactivate();
      }
    };
  }, [projectId, username]);

  const sendMessage = () => {
    if (!newMessage.trim()) {
      toast.error('Message cannot be empty', { position: 'top-right' });
      return;
    }
    if (stompClient.current?.connected) {
      const chatMessage = {
        userId: localStorage.getItem('githubLogin'),
        message: newMessage,
        timestamp: Date.now(),
        projectId,
      };
      try {
        stompClient.current.publish({
          destination: `/app/chat/${projectId}`,
          body: JSON.stringify(chatMessage),
        });
        setNewMessage('');
        sendTypingStatus(false);
      } catch (e) {
        console.error('Failed to send message:', e);
        toast.error('Failed to send message', { position: 'top-right' });
      }
    } else {
      toast.error('Chat not connected. Please wait.', { position: 'top-right' });
    }
  };

  const handleTyping = () => {
    sendTypingStatus(true);
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 5000);
  };

  return (
    <div className="flex flex-col h-[500px] bg-gray-50 rounded-xl p-4 font-sans text-gray-900">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-2 space-y-3">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm text-center mt-6">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={`${msg.userId}-${msg.timestamp}`}
              className={`flex flex-col animate-fade-in ${
                msg.userId === username ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] p-2.5 rounded-xl shadow-sm ${
                  msg.userId === username ? 'bg-blue-100 text-gray-900' : 'bg-white text-gray-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm font-medium">{msg.userId}</strong>
                  <span className="text-xs text-gray-500 flex-shrink-0 text-nowrap">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm mt-1 break-words">{msg.message}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicators */}
      {typingUsers.length > 0 && (
        <div className="text-xs text-gray-600 italic px-2 py-1 animate-pulse">
          {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
        </div>
      )}

      {/* Message Input */}
      <div className="mt-3 flex items-center space-x-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="bg-gradient-to-r from-blue-400 to-blue-500 text-white p-2 rounded-lg hover:from-blue-500 hover:to-blue-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-blue-300"
          title="Send message"
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ChatBox;

// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import SockJS from 'sockjs-client';
// import { Client } from '@stomp/stompjs';
// import debounce from 'lodash/debounce';
// import { toast } from 'react-toastify';
// import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

// const ChatBox = ({ projectId, username }) => {
//   const [messages, setMessages] = useState([]);
//   const [newMessage, setNewMessage] = useState('');
//   const [typingUsers, setTypingUsers] = useState([]);
//   const stompClient = useRef(null);
//   const typingTimeout = useRef(null);
//   const messagesEndRef = useRef(null);

//   const scrollToBottom = useCallback(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, []);

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages, scrollToBottom]);

//   const sendTypingStatus = useCallback(
//     debounce((typing) => {
//       if (stompClient.current?.connected) {
//         stompClient.current.publish({
//           destination: `/app/typing/${projectId}`,
//           body: JSON.stringify({ userId: username, typing }),
//         });
//       }
//     }, 500),
//     [projectId, username]
//   );

//   useEffect(() => {
//     const socket = new SockJS('http://localhost:8080/ws');
//     stompClient.current = new Client({
//       webSocketFactory: () => socket,
//       reconnectDelay: 5000,
//       onConnect: () => {
//         console.log('Chat WebSocket connected');

//         stompClient.current.subscribe(`/topic/chat/${projectId}`, (message) => {
//           try {
//             const chatMessage = JSON.parse(message.body);
//             setMessages((prev) => {
//               if (prev.some((msg) => msg.timestamp === chatMessage.timestamp && msg.userId === chatMessage.userId)) {
//                 return prev;
//               }
//               return [...prev, chatMessage].slice(-100);
//             });
//           } catch (e) {
//             console.error('Error parsing chat message:', e);
//             toast.error('Failed to load chat message');
//           }
//         });

//         stompClient.current.subscribe(`/topic/typing/${projectId}`, (message) => {
//           try {
//             const typingStatus = JSON.parse(message.body);
//             setTypingUsers((prev) => {
//               if (typingStatus.typing) {
//                 return prev.includes(typingStatus.userId) ? prev : [...prev, typingStatus.userId];
//               } else {
//                 return prev.filter((id) => id !== typingStatus.userId);
//               }
//             });
//           } catch (e) {
//             console.error('Error parsing typing status:', e);
//           }
//         });

//         stompClient.current.publish({
//           destination: `/app/joinChat/${projectId}`,
//           body: JSON.stringify({ userId: username }),
//         });

//         stompClient.current.subscribe(`/topic/sessionChat/${projectId}`, (message) => {
//           try {
//             const sessionData = JSON.parse(message.body);
//             if (sessionData.chatMessages) {
//               setMessages(sessionData.chatMessages.slice(-100));
//             }
//           } catch (e) {
//             console.error('Error parsing session data:', e);
//             toast.error('Failed to load chat history');
//           }
//         });
//       },
//       onStompError: (frame) => {
//         console.error('Chat STOMP error:', frame);
//         toast.error('Chat connection error. Please try again.');
//       },
//       onWebSocketClose: () => {
//         console.warn('Chat WebSocket closed');
//         toast.warn('Chat connection closed. Reconnecting...');
//       },
//     });

//     stompClient.current.activate();

//     return () => {
//       if (stompClient.current) {
//         stompClient.current.deactivate();
//       }
//     };
//   }, [projectId, username]);

//   const sendMessage = () => {
//     if (!newMessage.trim()) {
//       toast.error('Message cannot be empty');
//       return;
//     }
//     if (stompClient.current?.connected) {
//       const chatMessage = {
//         userId: localStorage.getItem('githubLogin'),
//         message: newMessage,
//         timestamp: Date.now(),
//         projectId,
//       };
//       try {
//         stompClient.current.publish({
//           destination: `/app/chat/${projectId}`,
//           body: JSON.stringify(chatMessage),
//         });
//         setNewMessage('');
//         sendTypingStatus(false);
//       } catch (e) {
//         console.error('Failed to send message:', e);
//         toast.error('Failed to send message');
//       }
//     } else {
//       toast.error('Chat not connected. Please wait.');
//     }
//   };

//   const handleTyping = () => {
//     sendTypingStatus(true);
//     if (typingTimeout.current) {
//       clearTimeout(typingTimeout.current);
//     }
//     typingTimeout.current = setTimeout(() => {
//       sendTypingStatus(false);
//     }, 5000);
//   };

//   return (
//     <div className="flex flex-col h-[500px] bg-gray-50 rounded-lg p-4">
//       {/* Chat Messages */}
//       <div className="flex-1 overflow-y-auto px-2 space-y-3">
//         {messages.length === 0 ? (
//           <p className="text-gray-500 text-sm text-center mt-4">No messages yet. Start the conversation!</p>
//         ) : (
//           messages.map((msg, index) => (
//             <div
//               key={`${msg.userId}-${msg.timestamp}`}
//               className={`flex flex-col ${
//                 msg.userId === username ? 'items-end' : 'items-start'
//               }`}
//             >
//               <div
//                 className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
//                   msg.userId === username
//                     ? 'bg-blue-100 text-gray-900'
//                     : 'bg-white text-gray-900'
//                 }`}
//               >
//                 <div className="flex items-baseline space-x-2">
//                   <strong className="text-sm font-semibold">{msg.userId}</strong>
//                   <span className="text-xs text-gray-500">
//                     {new Date(msg.timestamp).toLocaleTimeString([], {
//                       hour: '2-digit',
//                       minute: '2-digit',
//                     })}
//                   </span>
//                 </div>
//                 <p className="text-sm mt-1 break-words">{msg.message}</p>
//               </div>
//             </div>
//           ))
//         )}
//         <div ref={messagesEndRef} />
//       </div>

//       {/* Typing Indicators */}
//       {typingUsers.length > 0 && (
//         <div className="text-xs text-gray-600 italic px-2 py-1 animate-pulse">
//           {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
//         </div>
//       )}

//       {/* Message Input */}
//       <div className="mt-2 flex items-center space-x-2">
//         <input
//           type="text"
//           value={newMessage}
//           onChange={(e) => {
//             setNewMessage(e.target.value);
//             handleTyping();
//           }}
//           onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
//           className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
//           placeholder="Type a message..."
//         />
//         <button
//           onClick={sendMessage}
//           className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
//           title="Send message"
//         >
//           <PaperAirplaneIcon className="w-5 h-5" />
//         </button>
//       </div>
//     </div>
//   );
// };

// export default ChatBox;

// // // src/components/ChatBox.jsx
// // import React, { useState, useEffect, useRef, useCallback } from "react";
// // import SockJS from "sockjs-client";
// // import { Client } from "@stomp/stompjs";
// // import debounce from "lodash/debounce";

// // const ChatBox = ({ projectId, username }) => {
// //   const [messages, setMessages] = useState([]);
// //   const [newMessage, setNewMessage] = useState("");
// //   const [typingUsers, setTypingUsers] = useState([]);
// //   const stompClient = useRef(null);
// //   const typingTimeout = useRef(null);
// //   const messagesEndRef = useRef(null);

// //   // Scroll to bottom when new messages arrive
// //   const scrollToBottom = useCallback(() => {
// //     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
// //   }, []);

// //   useEffect(() => {
// //     scrollToBottom();
// //   }, [messages, scrollToBottom]);

// //   // Debounced typing handler
// //   const sendTypingStatus = useCallback(
// //     debounce((typing) => {
// //       if (stompClient.current?.connected) {
// //         stompClient.current.publish({
// //           destination: `/app/typing/${projectId}`,
// //           body: JSON.stringify({ userId: username, typing }),
// //         });
// //       }
// //     }, 500),
// //     [projectId, username]
// //   );

// //   // Initialize WebSocket connection
// //   useEffect(() => {
// //     const socket = new SockJS("http://localhost:8080/ws");
// //     stompClient.current = new Client({
// //       webSocketFactory: () => socket,
// //       reconnectDelay: 5000,
// //       onConnect: () => {
// //         console.log("Chat WebSocket connected");

// //         // Subscribe to chat messages
// //         stompClient.current.subscribe(`/topic/chat/${projectId}`, (message) => {
// //           const chatMessage = JSON.parse(message.body);
// //           setMessages((prev) => {
// //             // Avoid duplicates
// //             if (prev.some((msg) => msg.timestamp === chatMessage.timestamp && msg.userId === chatMessage.userId)) {
// //               return prev;
// //             }
// //             return [...prev, chatMessage].slice(-100); // Keep last 100 messages
// //           });
// //         });

// //         // Subscribe to typing indicators
// //         stompClient.current.subscribe(`/topic/typing/${projectId}`, (message) => {
// //           const typingStatus = JSON.parse(message.body);
// //           setTypingUsers((prev) => {
// //             if (typingStatus.typing) {
// //               return prev.includes(typingStatus.userId)
// //                 ? prev
// //                 : [...prev, typingStatus.userId];
// //             } else {
// //               return prev.filter((id) => id !== typingStatus.userId);
// //             }
// //           });
// //         });

// //         // Request chat history
// //         stompClient.current.publish({
// //           destination: `/app/joinChat/${projectId}`,
// //           body: JSON.stringify({ userId: username }),
// //         });

// //         // Subscribe to join response
// //         stompClient.current.subscribe(`/topic/sessionChat/${projectId}`, (message) => {
// //           const sessionData = JSON.parse(message.body);
// //           if (sessionData.chatMessages) {
// //             setMessages(sessionData.chatMessages.slice(-100)); // Limit to 100 messages
// //           }
// //         });
// //       },
// //       onStompError: (frame) => {
// //         console.error("Chat STOMP error:", frame);
// //       },
// //     });

// //     stompClient.current.activate();

// //     return () => {
// //       if (stompClient.current) {
// //         stompClient.current.deactivate();
// //       }
// //     };
// //   }, [projectId, username]);

// //   // Handle sending chat messages
// //   const sendMessage = () => {
// //     if (newMessage.trim() && stompClient.current?.connected) {
// //       const chatMessage = {
// //         userId: localStorage.getItem("githubLogin"),
// //         message: newMessage,
// //         timestamp: Date.now(),
// //         projectId,
// //       };
// //       stompClient.current.publish({
// //         destination: `/app/chat/${projectId}`,
// //         body: JSON.stringify(chatMessage),
// //       });
// //       setNewMessage("");
// //       sendTypingStatus(false); // Stop typing
// //     }
// //   };

// //   // Handle typing
// //   const handleTyping = () => {
// //     sendTypingStatus(true);

// //     // Clear previous timeout
// //     if (typingTimeout.current) {
// //       clearTimeout(typingTimeout.current);
// //     }

// //     // Stop typing after 5 seconds
// //     typingTimeout.current = setTimeout(() => {
// //       sendTypingStatus(false);
// //     }, 5000);
// //   };

// //   return (
// //     <div className="flex flex-col h-full text-white">
// //       {/* Chat Messages */}
// //       <div className="flex-1 overflow-y-auto p-2">
// //         {messages.map((msg, index) => (
// //           <div key={`${msg.userId}-${msg.timestamp}`} className="mb-2">
// //             <strong>{msg.userId}:</strong> {msg.message}
// //             <span className="text-xs text-gray-400 ml-2">
// //               {new Date(msg.timestamp).toLocaleTimeString()}
// //             </span>
// //           </div>
// //         ))}
// //         <div ref={messagesEndRef} />
// //       </div>

// //       {/* Typing Indicators */}
// //       {typingUsers.length > 0 && (
// //         <div className="text-sm text-gray-300 italic p-2">
// //           {typingUsers.join(", ")} {typingUsers.length > 1 ? "are" : "is"} typing...
// //         </div>
// //       )}

// //       {/* Message Input */}
// //       <div className="p-2">
// //         <input
// //           type="text"
// //           value={newMessage}
// //           onChange={(e) => {
// //             setNewMessage(e.target.value);
// //             handleTyping();
// //           }}
// //           onKeyPress={(e) => e.key === "Enter" && sendMessage()}
// //           className="w-full p-2 rounded bg-gray-700 text-white border-none focus:outline-none"
// //           placeholder="Type a message..."
// //         />
// //       </div>
// //     </div>
// //   );
// // };

// // export default ChatBox;