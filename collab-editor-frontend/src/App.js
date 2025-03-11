import React, { useState, useEffect } from "react";
import { Stomp } from "@stomp/stompjs";
import * as SockJS from "sockjs-client";
import MonacoEditor from "@monaco-editor/react";
import { executeCode } from "./editorController"; 

const App = () => {
  const [code, setCode] = useState("// Start coding...");
  const [stompClient, setStompClient] = useState(null);
  const [name, setName] = useState("");
  const [users, setUsers] = useState([]);
  const [executionResult, setExecutionResult] = useState("");

  useEffect(() => {
    if (!name) return; // Don't connect until the name is set

    const socket = new SockJS("http://localhost:8080/ws");
    const client = Stomp.over(socket);

    client.connect({}, () => {
      console.log("✅ WebSocket Connected!");

      client.subscribe("/topic/updates", (message) => {
        console.log("📩 Code update received:", message.body);
        setCode(message.body);
      });

      client.subscribe("/topic/users", (message) => {
        console.log("👥 Active Users:", message.body);
        setUsers(JSON.parse(message.body));
      });

      client.subscribe("/topic/output", (message) => {
        console.log("💻 Execution Result:", message.body);
        setExecutionResult(message.body);
      });

      client.send("/app/join", {}, JSON.stringify({ name }));
    });

    setStompClient(client);

    return () => {
      if (client.connected) {
        console.log("❌ Disconnecting WebSocket...");
        client.send("/app/leave", {}, JSON.stringify({ name }));
        client.disconnect();
      }
    };
  }, [name]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (stompClient && stompClient.connected) {
      stompClient.send("/app/code", {}, newCode);
    } else {
      console.error("⚠️ WebSocket is not connected!");
    }
  };

  const handleRunCode = async () => {
    const languageId = 100; // Python (Change as needed)
    const stdin = ""; // Provide input if needed

    console.log("🚀 Sending code for execution...");
    const result = await executeCode(code, languageId, stdin); 
    console.log("✅ Execution response received:", result);

    setExecutionResult(result);
  };

  return (
    <div style={{ height: "100vh", padding: "10px" }}>
      {!name ? (
        <div>
          <h2>Enter Your Name</h2>
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={() => setName(name.trim())} disabled={!name.trim()}>
            Join
          </button>
        </div>
      ) : (
        <div>
          <h2>Collaborative Code Editor</h2>
          <p>Editing as: <strong>{name}</strong></p>
          <p>Active Users: {users.length > 0 ? users.join(", ") : "None"}</p>
          <MonacoEditor
            height="60vh"
            language="python"
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
          />
          <button onClick={handleRunCode} style={{ marginTop: "10px" }}>
            Run Code
          </button>
          <h3>Execution Result:</h3>
          <pre style={{ background: "#222", color: "#fff", padding: "10px" }}>
            {executionResult || "No output yet..."}
          </pre>
        </div>
      )}
    </div>
  );
};

export default App;
