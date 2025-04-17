import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import MonacoEditor from "@monaco-editor/react";
import ChatBox from "../components/ChatBox";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import debounce from "lodash/debounce";
import { concat } from "lodash";
import useExecuteCode from "./ExecutionProject";

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false); // State for commit modal
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [commitMessage, setCommitMessage] = useState(""); // State for commit message
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modifiedFiles, setModifiedFiles] = useState({}); // Track modified files
  const {
    executeCode,
    executionResult,
    executionLoading,
    executionError,
    setExecutionResult,
    setExecutionError,
  } = useExecuteCode();

  const stompClient = useRef(null);
  const editorRef = useRef(null);
  const subscriptionRef = useRef(null);
  const userId = localStorage.getItem("githubLogin");
  console.log("userId:", userId)

  

  // Determine language based on file extension
  const getFileTypeInfo = (filePath) => {
    if (!filePath) return { language: "plaintext", judge0Language: null };
    const extension = filePath.split(".").pop().toLowerCase();
    const languageMap = {
      js: { language: "javascript", judge0Language: "javascript" },
      py: { language: "python", judge0Language: "python3" },
      html: { language: "html", judge0Language: null },
      css: { language: "css", judge0Language: null },
      json: { language: "json", judge0Language: null },
      md: { language: "markdown", judge0Language: null },
      ts: { language: "typescript", judge0Language: "typescript" },
      java: { language: "java", judge0Language: "java" },
      c: { language: "c", judge0Language: "c" },
      cpp: { language: "cpp", judge0Language: "cpp" },
    };
    return languageMap[extension] || { language: "plaintext", judge0Language: null };
  };

  // Debounced function to send editor changes
  const sendEditorChange = useCallback(
    debounce((value) => {
      if (stompClient.current?.connected && currentFile) {
        console.log(`Sending edit for ${currentFile} at ${Date.now()}`);
        const message = {
          projectId,
          senderId: userId.current,
          type: "edit",
          content: value,
          timestamp: Date.now(),
        };
        try {
          stompClient.current.publish({
            destination: `/app/collaborate/${projectId}/${currentFile}`,
            body: JSON.stringify(message),
          });
        } catch (e) {
          console.error("Failed to send edit:", e);
        }
      } else {
        console.warn(`Cannot send edit: connected=${stompClient.current?.connected}, file=${currentFile}`);
      }
    }, 300),
    [projectId, currentFile]
  );

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");
    stompClient.current = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("WebSocket connected");
        if (projectId && currentFile) {
          subscribeToFileUpdates();
          requestInitialCode();
        }
      },
      onStompError: (frame) => {
        console.error("STOMP error:", frame);
      },
      onWebSocketClose: () => {
        console.warn("WebSocket closed");
      },
    });

    stompClient.current.activate();

    return () => {
      if (stompClient.current) {
        stompClient.current.deactivate();
        console.log("WebSocket deactivated");
      }
    };
  }, [projectId]);

  // Manage subscriptions when currentFile changes
  useEffect(() => {
    if (stompClient.current?.connected && projectId && currentFile) {
      console.log(`Setting up subscription for: ${currentFile}`);
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        console.log(`Unsubscribed from previous file`);
      }
      subscribeToFileUpdates();
      requestInitialCode();
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        console.log(`Cleaned up subscription for ${currentFile}`);
      }
    };
  }, [currentFile, projectId]);

  const subscribeToFileUpdates = () => {
    if (!stompClient.current?.connected) {
      console.warn("Cannot subscribe: WebSocket not connected");
      return;
    }
    subscriptionRef.current = stompClient.current.subscribe(
      `/topic/collaboration/${projectId}/${currentFile}`,
      (message) => {
        try {
          console.log(`Received edit for ${currentFile} at ${Date.now()}`);
          const collaborationMessage = JSON.parse(message.body);
          if (collaborationMessage.senderId !== userId.current) {
            const newContent = collaborationMessage.content || "";
            setFileContent(newContent);
            if (editorRef.current) {
              const position = editorRef.current.getPosition();
              const currentValue = editorRef.current.getValue();
              if (currentValue !== newContent) {
                console.log("Applying update to editor");
                editorRef.current.setValue(newContent);
                editorRef.current.setPosition(position);
              } else {
                console.log("No update needed: content matches");
              }
            } else {
              console.warn("Editor ref not ready");
            }
          }
        } catch (e) {
          console.error("Error parsing collaboration message:", e, message.body);
        }
      }
    );
    console.log(`Subscribed to /topic/collaboration/${projectId}/${currentFile}`);
  };

  const requestInitialCode = () => {
    if (stompClient.current?.connected && currentFile) {
      console.log(`Requesting initial code for ${currentFile}`);
      stompClient.current.publish({
        destination: `/app/requestCode/${projectId}/${currentFile}`,
        body: JSON.stringify({ userId: userId.current }),
      });
    }
  };

  // Transform flat API response into nested file tree
  const buildFileTree = (fileData) => {
    const tree = [];
    const folders = {};

    Object.entries(fileData).forEach(([path, content]) => {
      const parts = path.split("/");
      let currentLevel = tree;
      let currentPath = "";

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (index === parts.length - 1) {
          // It's a file
          currentLevel.push({
            name: part,
            type: "file",
            path: currentPath,
            content: content || "",
            originalContent: content || "", // Store original content for comparison
          });
        } else {
          // It's a folder
          if (!folders[currentPath]) {
            const folder = {
              name: part,
              type: "folder",
              path: currentPath,
              children: [],
            };
            folders[currentPath] = folder;
            currentLevel.push(folder);
            currentLevel = folder.children;
          } else {
            currentLevel = folders[currentPath].children;
          }
        }
      });
    });

    // Sort: folders first, then files
    const sortTree = (items) =>
      items.sort((a, b) => {
        if (a.type === "folder" && b.type === "file") return -1;
        if (a.type === "file" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });

    const sortedTree = sortTree(tree);
    sortedTree.forEach((item) => {
      if (item.type === "folder") {
        item.children = sortTree(item.children);
      }
    });

    return sortedTree;
  };

  // fixed : fetch project data
  useEffect(() => {
    const fetchProjectData = async () => {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams(location.search);
      const owner = queryParams.get("owner");
      //const owner = localStorage.getItem("githubLogin");
      const accessToken = localStorage.getItem("token");
      const repo = projectId;
      const branch = "main";
  
      if (!owner) {
        alert("GitHub login missing. Please log in again.");
        navigate("/");
        return;
      }
  
      if (!accessToken) {
        alert("Access token missing. Please log in again.");
        navigate("/");
        return;
      }
  
      try {
        const params = new URLSearchParams({ owner, repo, branch });
  
        const response = await fetch(`/api/github/files?${params.toString()}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
  
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
  
        const fileData = await response.json();
  
        console.log("Fetched files:", fileData);
  
        const fileTree = buildFileTree(fileData);
  
        const projectData = {
          id: projectId,
          name: repo,
          description: fileData["README.md"]?.split("\n")[1] || `Description for ${repo}`,
          files: fileTree,
          owner,
          repo,
        };
  
        setProject(projectData);
        setFiles(projectData.files || []);
  
        const initialExpanded = {};
        const collectFolders = (fileList) => {
          fileList.forEach((file) => {
            if (file.type === "folder") {
              initialExpanded[file.path] = true;
              if (file.children) {
                collectFolders(file.children);
              }
            }
          });
        };
        collectFolders(projectData.files);
        setExpandedFolders(initialExpanded);
  
        const firstFile =
          findFileByPath(projectData.files, "index.js") ||
          projectData.files.find((f) => f.type === "file");
  
        if (firstFile) {
          console.log("Setting initial file:", firstFile.path);
          setCurrentFile(firstFile.path);
          setFileContent(firstFile.content || "");
        } else {
          console.warn("No files found for project");
          setCurrentFile(null);
          setFileContent("");
        }
      } catch (err) {
        console.error("Error fetching project data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
  
    fetchProjectData();
  }, [projectId]);
  
  // Handle editor changes
  const handleEditorChange = (value) => {
    setFileContent(value);
    sendEditorChange(value);

    // Track modified file content
    setModifiedFiles((prev) => ({
      ...prev,
      [currentFile]: value,
    }));

    // Update the file tree with the new content
    const updatedFiles = updateFileByPath(files, currentFile, (file) => ({
      ...file,
      content: value,
    }));
    setFiles(updatedFiles);
  };

  // Function to commit changes to GitHub
  const handleCommit = async () => {
    if (!commitMessage) {
      alert("Please enter a commit message");
      return;
    }
    const queryParams = new URLSearchParams(location.search);
    const owner = queryParams.get("owner");
    //const owner = localStorage.getItem("githubLogin");
    const accessToken = localStorage.getItem("token");
    const repo = projectId; // Assuming projectId is the repo name
    const branch = "main";
  
    // Collect all modified files
    const filesWithPaths = {};
    const allFiles = collectAllFiles(files); // Assuming this function works properly
    allFiles.forEach((file) => {
      if (modifiedFiles[file.path] && modifiedFiles[file.path] !== file.originalContent) {
        filesWithPaths[file.path] = modifiedFiles[file.path];
      }
    });
  
    if (Object.keys(filesWithPaths).length === 0) {
      alert("No changes to commit");
      return;
    }
  
    try {
      const commitRequest = {
        owner: owner,
        repo: repo,
        filesWithPaths: filesWithPaths,
        commitMessage: commitMessage,
        branch: branch, // Optionally add branch if needed for the backend
      };
  
      const response = await fetch("http://localhost:8080/api/github/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`, // Corrected authorization header
        },
        body: JSON.stringify(commitRequest),
      });
  
      if (!response.ok) {
        throw new Error(`Failed to commit: ${response.statusText}`);
      }
  
      const result = await response.text();
      alert(result); // Should show "✅ Commit successful."
      setCommitMessage(""); // Clear commit message
      setIsCommitModalOpen(false); // Close commit modal
  
      // Optionally, clear modified files after a successful commit
      setModifiedFiles({});
    } catch (err) {
      console.error("Error committing to GitHub:", err);
      alert(`Error committing: ${err.message}`);
    }
  };  

  // Helper to collect all files from the tree
  const collectAllFiles = (fileList) => {
    const allFiles = [];
    fileList.forEach((item) => {
      if (item.type === "file") {
        allFiles.push(item);
      } else if (item.type === "folder" && item.children) {
        allFiles.push(...collectAllFiles(item.children));
      }
    });
    return allFiles;
  };

  // Store editor reference and configure language
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    console.log("Editor mounted for:", currentFile);
    if (currentFile) {
      const { language } = getFileTypeInfo(currentFile);
      monaco.editor.setModelLanguage(editor.getModel(), language);
      monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: ["."],
        provideCompletionItems: (model, position) => {
          const suggestions = language === "javascript" ? [
            {
              label: "consoleLog",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "console.log(${1:msg});",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Log to console",
            },
            {
              label: "function",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "function ${1:name}(${2:params}) {\n  ${3}\n}",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Function declaration",
            },
            {
              label: "arrowFunc",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "const ${1:name} = (${2:params}) => {\n  ${3}\n};",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Arrow function",
            },
          ] : language === "python" ? [
            {
              label: "print",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "print(${1:msg})",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Print to console",
            },
            {
              label: "def",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "def ${1:name}(${2:params}):\n    ${3:pass}",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Function definition",
            },
            {
              label: "class",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "class ${1:Name}:\n    def __init__(self):\n        ${2:pass}",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Class definition",
            },
          ] : [];
          return { suggestions };
        },
      });
    }
  };

  const findFileByPath = (fileList, filePath) => {
    for (const item of fileList) {
      if (item.type === "file" && item.path === filePath) return item;
      if (item.type === "folder" && item.children) {
        const found = findFileByPath(item.children, filePath);
        if (found) return found;
      }
    }
    return null;
  };

  const updateFileByPath = (fileList, targetPath, updateFn) => {
    return fileList.map((item) => {
      if (item.path === targetPath) {
        return updateFn(item);
      }
      if (item.type === "folder" && item.children) {
        return {
          ...item,
          children: updateFileByPath(item.children, targetPath, updateFn),
        };
      }
      return item;
    });
  };

  const handleFileClick = (filePath) => {
    console.log(`Switching to file: ${filePath}`);
    setCurrentFile(filePath);
    const file = findFileByPath(files, filePath);
    const content = modifiedFiles[filePath] || file?.content || "";
    setFileContent(content);
    if (editorRef.current) {
      const { language } = getFileTypeInfo(filePath);
      window.monaco.editor.setModelLanguage(editorRef.current.getModel(), language);
      editorRef.current.setValue(content);
    }
    // Reset execution state
    setExecutionResult(null);
    setExecutionError(null);
  };

  const handleFolderClick = (folder) => {
    setSelectedFolder(folder);
    setNewFileName("");
    setIsCreateFileModalOpen(true);
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const handleCreateFile = () => {
    if (!newFileName) {
      alert("Please enter a file name");
      return;
    }
    let updatedFiles = [...files];
    const newFileContent = "";
    if (selectedFolder) {
      const newFilePath = `${selectedFolder.path}/${newFileName}`;
      const newFile = {
        name: newFileName,
        type: "file",
        path: newFilePath,
        content: newFileContent,
        originalContent: newFileContent,
      };
      updatedFiles = updateFileByPath(updatedFiles, selectedFolder.path, (folder) => ({
        ...folder,
        children: [...(folder.children || []), newFile],
      }));
      console.log(`Added ${newFileName} to ${selectedFolder.path}:`, updatedFiles);
    } else {
      updatedFiles.push({
        name: newFileName,
        type: "file",
        path: newFileName,
        content: newFileContent,
        originalContent: newFileContent,
      });
    }

    setFiles(updatedFiles);
    if (selectedFolder) {
      setExpandedFolders((prev) => ({
        ...prev,
        [selectedFolder.path]: true,
      }));
    }
    setNewFileName("");
    setIsCreateFileModalOpen(false);
  };

  const handleCreateFolder = () => {
    if (!newFolderName) {
      alert("Please enter a folder name");
      return;
    }
    const updatedFiles = [...files, {
      name: newFolderName,
      type: "folder",
      path: newFolderName,
      children: [],
    }];
    setFiles(updatedFiles);
    setExpandedFolders((prev) => ({
      ...prev,
      [newFolderName]: true,
    }));
    setNewFolderName("");
    setIsCreateFolderModalOpen(false);
  };

  const renderFileTree = (fileList) =>
    fileList.map((file) =>
      file.type === "file" ? (
        <li key={file.path} className="flex items-center pl-2 py-1">
          <span
            className={`cursor-pointer flex-1 rounded ${currentFile === file.path ? 'bg-blue-100 text-blue-800' : 'text-blue-600 hover:text-blue-800'}`}
            onClick={() => handleFileClick(file.path)}
          >
            📄 {file.name}
          </span>
          {getFileTypeInfo(file.path).judge0Language && (
            <button
              onClick={() => {
                const fileData = findFileByPath(files, file.path);
                executeCode(
                  file.path,
                  fileData.content,
                  projectId,
                  userId.current,
                  getFileTypeInfo(file.path).judge0Language
                );
              }}
              disabled={executionLoading}
              className={`text-orange-500 hover:text-orange-700 text-sm ml-2 ${executionLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Execute file"
            >
              ▶
            </button>
          )}
        </li>
      ) : (
        <li key={file.path}>
          <div className="flex items-center pl-2 py-1">
            <div
              className="flex items-center font-semibold cursor-pointer text-gray-800 hover:text-gray-900 flex-1"
              onClick={() => toggleFolder(file.path)}
            >
             <span className="mr-1">{expandedFolders[file.path] ? "▼" : "▶"}</span>
              📁 {file.name}
            </div>
            <button
              onClick={() => handleFolderClick(file)}
              className="text-green-500 hover:text-green-700 text-sm ml-2"
              title="Add file to folder"
            >
              +
            </button>
          </div>
          {expandedFolders[file.path] && file.children && file.children.length > 0 && (
            <ul className="pl-4">{renderFileTree(file.children)}</ul>
          )}
        </li>
      )
    );

    return (
      <div className="flex min-h-screen bg-gray-100">
        {/* Left Sidebar - File Tree */}
        <div className="w-1/4 bg-white p-4 shadow-md">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Files</h3>
          {loading ? (
            <p className="text-gray-500">Loading files...</p>
          ) : error ? (
            <p className="text-red-500">Error: {error}</p>
          ) : files.length ? (
            <ul className="space-y-1">{renderFileTree(files)}</ul>
          ) : (
            <p className="text-gray-500">No files found</p>
          )}
          <div className="mt-6 space-y-2">
            <button
              onClick={() => {
                setSelectedFolder(null);
                setIsCreateFileModalOpen(true);
              }}
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition"
            >
              Create File
            </button>
            <button
              onClick={() => setIsCreateFolderModalOpen(true)}
              className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 transition"
            >
              Create Folder
            </button>
            <button
              onClick={() => setIsCommitModalOpen(true)}
              className="w-full bg-purple-500 text-white p-2 rounded hover:bg-purple-600 transition"
            >
              Commit Changes
            </button>
          </div>
        </div>
  
        {/* Center - Code Editor and Execution Results */}
        <div className="w-2/4 p-6">
          <h2 className="text-2xl font-semibold mb-2 text-gray-800">{project?.name || "Loading..."}</h2>
          <p className="text-gray-600 mb-4">{project?.description || ""}</p>
          {loading ? (
            <div className="flex items-center justify-center h-[600px] bg-gray-200 rounded">
              <p className="text-gray-500 text-lg">Loading editor...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[600px] bg-gray-200 rounded">
              <p className="text-red-500 text-lg">Failed to load project: {error}</p>
            </div>
          ) : currentFile ? (
            <>
              <div className="mb-4">
                <MonacoEditor
                  height="400px"
                  language={getFileTypeInfo(currentFile).language}
                  value={fileContent}
                  onChange={handleEditorChange}
                  onMount={handleEditorDidMount}
                  options={{
                    theme: "vs-dark",
                    fontSize: 14,
                    automaticLayout: true,
                    minimap: { enabled: false },
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    suggest: {
                      snippetsPreventQuickSuggestions: false,
                      suggestions: true,
                    },
                    quickSuggestions: {
                      other: true,
                      comments: true,
                      strings: true,
                    },
                    padding: { top: 10, bottom: 10 },
                  }}
                />
              </div>
              {/* Execution Results Panel */}
              <div className="bg-gray-200 p-4 rounded">
                <h3 className="text-lg font-semibold mb-2 text-gray-800">Execution Results</h3>
                {executionLoading && (
                  <p className="text-gray-500">Executing...</p>
                )}
                {executionError && (
                  <p className="text-red-500">{executionError}</p>
                )}
                {executionResult && (
                  <div className="p-4 bg-white rounded shadow">
                    <p><strong>Status:</strong> {executionResult.status?.description}</p>
                    {executionResult.stdout && (
                      <p><strong>Output (stdout):</strong> <pre>{executionResult.stdout}</pre></p>
                    )}
                    {executionResult.stderr && (
                      <p><strong>Error (stderr):</strong> <pre>{executionResult.stderr}</pre></p>
                    )}
                    <p><strong>Exit Code:</strong> {executionResult.exit_code ?? "N/A"}</p>
                    <p><strong>Time:</strong> {executionResult.time ? `${executionResult.time} s` : "N/A"}</p>
                    <p><strong>Memory:</strong> {executionResult.memory ? `${executionResult.memory} KB` : "N/A"}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[600px] bg-gray-200 rounded">
              <p className="text-gray-500 text-lg">Select a file to edit</p>
            </div>
          )}
        </div>
  
        {/* Right Sidebar - Chat */}
        <div className="w-1/4 bg-gray-800 text-white p-4 shadow-md">
          <h3 className="text-xl font-bold mb-4">Chat</h3>
          <ChatBox projectId={projectId} username={userId.current} />
        </div>
  
        {/* Create File Modal */}
        {isCreateFileModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded-lg shadow-xl w-1/3">
              <h3 className="text-lg font-semibold mb-4">Create a New File</h3>
              <input
                type="text"
                placeholder="File Name (e.g., script.js)"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="border p-2 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setIsCreateFileModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFile}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
  
        {/* Create Folder Modal */}
        {isCreateFolderModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded-lg shadow-xl w-1/3">
              <h3 className="text-lg font-semibold mb-4">Create a New Folder</h3>
              <input
                type="text"
                placeholder="Folder Name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="border p-2 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setIsCreateFolderModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
  
        {/* Commit Modal */}
        {isCommitModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded-lg shadow-xl w-1/3">
              <h3 className="text-lg font-semibold mb-4">Commit Changes to GitHub</h3>
              <input
                type="text"
                placeholder="Commit Message (e.g., Update mergeSort.js)"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="border p-2 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setIsCommitModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommit}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition"
                >
                  Commit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
};

export default ProjectWorkspace;
