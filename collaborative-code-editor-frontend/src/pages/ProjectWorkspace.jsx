import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import MonacoEditor from "@monaco-editor/react";
import ChatBox from "../components/ChatBox";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import debounce from "lodash/debounce";
import { toast } from 'react-toastify';
import useExecuteCode from './ExecutionProject';
import {
  FolderIcon,
  DocumentIcon,
  PlayIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeBracketIcon,
  ArrowLeftIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [expandedFolders, setExpandedFolders] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modifiedFiles, setModifiedFiles] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [executionInput, setExecutionInput] = useState("");

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

  const sendEditorChange = useCallback(
    debounce((value) => {
      if (stompClient.current?.connected && selectedItem?.type === "file") {
        const message = {
          projectId,
          senderId: userId,
          type: "edit",
          content: value,
          timestamp: Date.now(),
        };
        try {
          stompClient.current.publish({
            destination: `/app/collaborate/${projectId}/${selectedItem.path}`,
            body: JSON.stringify(message),
          });
        } catch (e) {
          console.error("Failed to send edit:", e);
        }
      }
    }, 300),
    [projectId, selectedItem, userId]
  );

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");
    stompClient.current = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("WebSocket connected");

        stompClient.current.publish({
          destination: `/app/join/${projectId}/`,
          body: JSON.stringify(userId),
        });

        stompClient.current.subscribe(`/topic/session/${projectId}`, (message) => {
          console.log("Session update:", message.body);
        });

        if (selectedItem?.type === "file") {
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
        if (stompClient.current.connected) {
          stompClient.current.publish({
            destination: `/app/leave/${projectId}/`,
            body: JSON.stringify(userId),
          });
        }
        stompClient.current.deactivate();
        console.log("WebSocket deactivated");
      }
    };
  }, [projectId, userId]);

  useEffect(() => {
    if (stompClient.current?.connected && projectId && selectedItem?.type === "file") {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      subscribeToFileUpdates();
      requestInitialCode();
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [selectedItem, projectId]);

  const subscribeToFileUpdates = () => {
    if (!stompClient.current?.connected || selectedItem?.type !== "file") return;
    subscriptionRef.current = stompClient.current.subscribe(
      `/topic/collaboration/${projectId}/${selectedItem.path}`,
      (message) => {
        try {
          const collaborationMessage = JSON.parse(message.body);
          const newContent = collaborationMessage.content || "";
          setFileContent(newContent);
          if (editorRef.current) {
            const position = editorRef.current.getPosition();
            const currentValue = editorRef.current.getValue();
            if (currentValue !== newContent) {
              editorRef.current.setValue(newContent);
              editorRef.current.setPosition(position);
            }
          }
          const updatedFiles = updateFileByPath(files, selectedItem.path, (file) => ({
            ...file,
            content: newContent,
          }));
          setFiles(updatedFiles);
        } catch (e) {
          console.error("Error parsing collaboration message:", e);
        }
      }
    );
  };

  const requestInitialCode = () => {
    if (stompClient.current?.connected && selectedItem?.type === "file") {
      stompClient.current.publish({
        destination: `/app/requestCode/${projectId}/${selectedItem.path}`,
        body: JSON.stringify({ userId }),
      });
    }
  };

  useEffect(() => {
    const fetchProjectData = async () => {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams(location.search);
      const owner = queryParams.get("owner");
      const accessToken = localStorage.getItem("token");
      const repo = projectId;
      const branch = "main";

      if (!owner || !accessToken) {
        alert("Authentication missing. Please log in again.");
        navigate("/");
        return;
      }

      try {
        const params = new URLSearchParams({ owner, repo, branch });
        const response = await fetch(`/api/github/files?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.statusText}`);
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
              if (file.children) collectFolders(file.children);
            }
          });
        };
        collectFolders(projectData.files);
        console.log("Initial expanded folders:", initialExpanded);
        setExpandedFolders(initialExpanded);

        const firstFile =
          findFileByPath(projectData.files, "index.js") ||
          projectData.files.find((f) => f.type === "file");

        if (firstFile) {
          setSelectedItem(firstFile);
          setFileContent(firstFile.content);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId, navigate]);

  const handleEditorChange = (value) => {
    setFileContent(value);
    sendEditorChange(value);
    setModifiedFiles((prev) => ({
      ...prev,
      [selectedItem?.path]: value,
    }));
    const updatedFiles = updateFileByPath(files, selectedItem?.path, (file) => ({
      ...file,
      content: value,
    }));
    setFiles(updatedFiles);
  };

  const handleCommit = async () => {
    if (!commitMessage) {
      toast.error('Please enter a commit message', { position: 'top-right' });
      return;
    }
    const queryParams = new URLSearchParams(location.search);
    const owner = queryParams.get("owner");
    const accessToken = localStorage.getItem("token");
    const repo = projectId;
    const branch = "main";

    const filesWithPaths = {};
    const allFiles = collectAllFiles(files);
    allFiles.forEach((file) => {
      if (modifiedFiles[file.path] !== undefined) {
        filesWithPaths[file.path] = modifiedFiles[file.path];
      }
    });
    Object.entries(modifiedFiles).forEach(([path, content]) => {
      if (!allFiles.some((file) => file.path === path)) {
        filesWithPaths[path] = content;
      }
    });

    if (Object.keys(filesWithPaths).length === 0) {
      toast.error('No changes to commit', { position: 'top-right' });
      return;
    }

    try {
      const commitRequest = {
        owner,
        repo,
        filesWithPaths,
        commitMessage,
        branch,
      };

      const response = await fetch("http://localhost:8080/api/github/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(commitRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to commit: ${response.statusText}`);
      }

      const updatedFiles = files.map((file) => {
        if (file.type === "file" && filesWithPaths[file.path] !== undefined) {
          return { ...file, originalContent: filesWithPaths[file.path] };
        } else if (file.type === "folder" && file.children) {
          return {
            ...file,
            children: file.children.map((child) =>
              child.type === "file" && filesWithPaths[child.path] !== undefined
                ? { ...child, originalContent: filesWithPaths[child.path] }
                : child
            ),
          };
        }
        return file;
      });

      setFiles(updatedFiles);
      setModifiedFiles({});
      toast.success('✅ Commit successful', { position: 'top-right' });
      setCommitMessage("");
      setIsCommitModalOpen(false);
      if (isLeaveModalOpen) {
        setIsLeaveModalOpen(false);
        if (stompClient.current?.connected) {
          stompClient.current.publish({
            destination: `/app/leave/${projectId}/`,
            body: JSON.stringify(userId),
          });
        }
        navigate("/projects");
      }
    } catch (err) {
      toast.error(`Error committing: ${err.message}`, { position: 'top-right' });
    }
  };

  const leaveWorkspace = () => {
    if (hasUncommittedChanges()) {
      setIsLeaveModalOpen(true);
    } else {
      if (stompClient.current?.connected) {
        stompClient.current.publish({
          destination: `/app/leave/${projectId}/`,
          body: JSON.stringify(userId),
        });
      }
      navigate("/projects");
    }
  };

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
          currentLevel.push({
            name: part,
            type: "file",
            path: currentPath,
            content: content || "",
            originalContent: content || "",
          });
        } else {
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

    console.log("Built file tree:", JSON.stringify(sortedTree, null, 2));
    return sortedTree;
  };

  const collectAllFiles = (fileList) => {
    const allFiles = [];
    fileList.forEach((item) => {
      if (item.type === "file") allFiles.push(item);
      else if (item.type === "folder" && item.children) {
        allFiles.push(...collectAllFiles(item.children));
      }
    });
    return allFiles;
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    if (selectedItem?.type === "file") {
      const { language } = getFileTypeInfo(selectedItem.path);
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
      if (item.path === filePath) return item;
      if (item.type === "folder" && item.children) {
        const found = findFileByPath(item.children, filePath);
        if (found) return found;
      }
    }
    return null;
  };

  const updateFileByPath = (fileList, targetPath, updateFn) => {
    return fileList.map((item) => {
      if (item.path === targetPath) return updateFn(item);
      if (item.type === "folder" && item.children) {
        return {
          ...item,
          children: updateFileByPath(item.children, targetPath, updateFn),
        };
      }
      return item;
    });
  };

  const getParentPath = (path) => {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  };

  const handleFileClick = (file) => {
    setSelectedItem(file);
    setFileContent(file.content);
    setExecutionResult(null);
    setExecutionError(null);
  };

  const handleFolderClick = (folder) => {
    setSelectedItem(folder);
    toggleFolder(folder.path);
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: prev[folderPath] === undefined ? true : !prev[folderPath],
    }));
  };

  const toggleAllFolders = (expand) => {
    const newExpandedFolders = { ...expandedFolders };
    const collectFolders = (fileList) => {
      fileList.forEach((file) => {
        if (file.type === "folder") {
          newExpandedFolders[file.path] = expand;
          if (file.children) collectFolders(file.children);
        }
      });
    };
    collectFolders(files);
    setExpandedFolders(newExpandedFolders);
  };

  const handleCreateFile = () => {
    if (!newFileName) {
      alert("Please enter a file name");
      return;
    }
    if (newFileName.includes("/")) {
      alert("File name cannot contain '/'");
      return;
    }
    let updatedFiles = [...files];
    const newFileContent = "";

    let targetPath = newFileName;
    let parentPath = "";
    if (selectedItem) {
      if (selectedItem.type === "folder") {
        parentPath = selectedItem.path;
        targetPath = `${parentPath}/${newFileName}`;
      } else if (selectedItem.type === "file") {
        parentPath = getParentPath(selectedItem.path);
        targetPath = parentPath ? `${parentPath}/${newFileName}` : newFileName;
      }
    }

    const parentFolder = parentPath ? findFileByPath(files, parentPath) : { children: files };
    if (parentFolder?.children?.some((item) => item.name === newFileName)) {
      alert("A file or folder with this name already exists");
      return;
    }

    const newFile = {
      name: newFileName,
      type: "file",
      path: targetPath,
      content: newFileContent,
      originalContent: newFileContent,
    };

    if (parentPath) {
      updatedFiles = updateFileByPath(updatedFiles, parentPath, (folder) => ({
        ...folder,
        children: [...(folder.children || []), newFile],
      }));
    } else {
      updatedFiles.push(newFile);
    }

    setFiles(updatedFiles);
    setModifiedFiles((prev) => ({
      ...prev,
      [targetPath]: newFileContent,
    }));
    if (parentPath) {
      setExpandedFolders((prev) => ({
        ...prev,
        [parentPath]: true,
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
    if (newFolderName.includes("/")) {
      alert("Folder name cannot contain '/'");
      return;
    }
    let updatedFiles = [...files];

    let targetPath = newFolderName;
    let parentPath = "";
    if (selectedItem) {
      if (selectedItem.type === "folder") {
        parentPath = selectedItem.path;
        targetPath = `${parentPath}/${newFolderName}`;
      } else if (selectedItem.type === "file") {
        parentPath = getParentPath(selectedItem.path);
        targetPath = parentPath ? `${parentPath}/${newFolderName}` : newFolderName;
      }
    }

    const parentFolder = parentPath ? findFileByPath(files, parentPath) : { children: files };
    if (parentFolder?.children?.some((item) => item.name === newFolderName)) {
      alert("A file or folder with this name already exists");
      return;
    }

    const newFolder = {
      name: newFolderName,
      type: "folder",
      path: targetPath,
      children: [],
    };

    if (parentPath) {
      updatedFiles = updateFileByPath(updatedFiles, parentPath, (folder) => ({
        ...folder,
        children: [...(folder.children || []), newFolder],
      }));
    } else {
      updatedFiles.push(newFolder);
    }

    setFiles(updatedFiles);
    setModifiedFiles((prev) => ({
      ...prev,
      [targetPath]: "",
    }));
    setExpandedFolders((prev) => ({
      ...prev,
      [targetPath]: true,
      ...(parentPath && { [parentPath]: true }),
    }));
    setNewFolderName("");
    setIsCreateFolderModalOpen(false);
  };

  const handleDeleteItem = () => {
    if (!itemToDelete) return;

    const parentPath = getParentPath(itemToDelete.path);
    let updatedFiles = [...files];

    if (itemToDelete.type === "folder") {
      const collectPaths = (item) => {
        const paths = [item.path];
        if (item.children) {
          item.children.forEach((child) => {
            paths.push(...collectPaths(child));
          });
        }
        return paths;
      };
      const pathsToDelete = collectPaths(itemToDelete);
      setModifiedFiles((prev) => {
        const newModified = { ...prev };
        pathsToDelete.forEach((path) => {
          newModified[path] = null;
        });
        return newModified;
      });
    } else {
      setModifiedFiles((prev) => ({
        ...prev,
        [itemToDelete.path]: null,
      }));
    }

    if (parentPath) {
      updatedFiles = updateFileByPath(updatedFiles, parentPath, (folder) => ({
        ...folder,
        children: folder.children.filter((child) => child.path !== itemToDelete.path),
      }));
    } else {
      updatedFiles = updatedFiles.filter((file) => file.path !== itemToDelete.path);
    }

    setFiles(updatedFiles);
    if (selectedItem?.path === itemToDelete.path || (itemToDelete.type === "folder" && selectedItem?.path.startsWith(itemToDelete.path))) {
      setSelectedItem(null);
      setFileContent("");
    }
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
    toast.success(`${itemToDelete.type === "file" ? "File" : "Folder"} deleted`, { position: 'top-right' });
  };

  const hasUncommittedChanges = () => {
    return Object.keys(modifiedFiles).length > 0;
  };

  const handleLeaveConfirm = (commitFirst) => {
    if (commitFirst) {
      setIsLeaveModalOpen(false);
      setIsCommitModalOpen(true);
    } else {
      if (stompClient.current?.connected) {
        stompClient.current.publish({
          destination: `/app/leave/${projectId}/`,
          body: JSON.stringify(userId),
        });
      }
      setIsLeaveModalOpen(false);
      navigate("/projects");
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUncommittedChanges()) {
        event.preventDefault();
        event.returnValue = "You have uncommitted changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [modifiedFiles, files]);

  const renderFileTree = (fileList) =>
    fileList.map((file) => {
      console.log(`Rendering file/folder: ${file.path}, expanded: ${expandedFolders[file.path]}`);
      return file.type === "file" ? (
        <li
          key={file.path}
          className={`flex items-center pl-4 py-1.5 hover:bg-gray-200 rounded-lg transition-all duration-200 ease-in-out ${
            selectedItem?.path === file.path ? "bg-blue-50" : ""
          }`}
        >
          <DocumentIcon className="w-4 h-4 text-gray-400 mr-2" />
          <span
            className={`cursor-pointer flex-1 text-sm font-medium ${
              selectedItem?.path === file.path
                ? "text-blue-600"
                : "text-gray-600 hover:text-blue-500"
            }`}
            onClick={() => handleFileClick(file)}
          >
            {file.name}
            {modifiedFiles[file.path] !== undefined && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </span>
          <div className="flex items-center space-x-2">
            {getFileTypeInfo(file.path).judge0Language && (
              <button
                onClick={() => {
                  handleFileClick(file);
                  const fileData = findFileByPath(files, file.path);
                  executeCode(
                    file.path,
                    fileData.content,
                    projectId,
                    userId,
                    getFileTypeInfo(file.path).judge0Language,
                    executionInput
                  );
                }}
                disabled={executionLoading}
                className={`text-orange-400 hover:text-orange-500 p-1 rounded-full transition-all duration-200 ease-in-out ${
                  executionLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title="Execute file"
              >
                <PlayIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                setItemToDelete(file);
                setIsDeleteModalOpen(true);
              }}
              className="text-red-400 hover:text-red-500 p-1 rounded-full transition-all duration-200 ease-in-out"
              title="Delete file"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </li>
      ) : (
        <li key={file.path}>
          <div
            className={`flex items-center pl-4 py-1.5 hover:bg-gray-200 rounded-lg transition-all duration-200 ease-in-out ${
              selectedItem?.path === file.path ? "bg-blue-50" : ""
            }`}
          >
            <div
              className="flex items-center cursor-pointer text-gray-600 hover:text-gray-800 flex-1"
              onClick={() => handleFolderClick(file)}
            >
              {expandedFolders[file.path] ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 mr-2" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-gray-400 mr-2" />
              )}
              <FolderIcon className="w-4 h-4 text-gray-400 mr-2" />
              <span
                className={`text-sm font-medium ${
                  selectedItem?.path === file.path ? "text-blue-600" : ""
                }`}
              >
                {file.name}
                {modifiedFiles[file.path] !== undefined && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </span>
            </div>
            <button
              onClick={() => {
                setItemToDelete(file);
                setIsDeleteModalOpen(true);
              }}
              className="text-red-400 hover:text-red-500 p-1 rounded-full transition-all duration-200 ease-in-out"
              title="Delete folder"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
          {expandedFolders[file.path] ? (
            file.children && file.children.length > 0 ? (
              <ul className="pl-4">{renderFileTree(file.children)}</ul>
            ) : (
              <p className="pl-8 text-sm text-gray-500">No files in this folder</p>
            )
          ) : null}
        </li>
      );
    });

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
      <div className="w-full px-0 pt-5 pb-15">
        <div className="mb-6 flex items-center justify-between px-4 sm:px-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              {project?.name || 'Loading...'}
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full mt-2" />
            <p className="text-sm text-gray-500 mt-2">{project?.description || ''}</p>
          </div>
          <button
            onClick={leaveWorkspace}
            className="flex items-center text-sm text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ease-in-out"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Leave Workspace
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-1">
          <div
            className={`lg:w-1/5 bg-white shadow-sm rounded-2xl p-4 transition-all duration-300 ease-in-out ${
              isSidebarOpen ? 'block' : 'hidden lg:block'
            } mr-0 border border-gray-100`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Files</h2>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden text-gray-500 hover:text-blue-500 text-sm"
              >
                {isSidebarOpen ? 'Close' : 'Open'}
              </button>
            </div>
            <div className="flex space-x-2 mb-3">
              <button
                onClick={() => toggleAllFolders(true)}
                className="text-xs text-blue-500 hover:text-blue-600 transition-all duration-200"
              >
                Expand All
              </button>
              <button
                onClick={() => toggleAllFolders(false)}
                className="text-xs text-blue-500 hover:text-blue-600 transition-all duration-200"
              >
                Collapse All
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <svg
                  className="animate-spin h-6 w-6 text-blue-400"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
                  />
                </svg>
              </div>
            ) : error ? (
              <p className="text-red-500 text-sm">Error: {error}</p>
            ) : files.length ? (
              <ul className="space-y-1">{renderFileTree(files)}</ul>
            ) : (
              <p className="text-gray-500 text-sm">No files found</p>
            )}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setIsCreateFileModalOpen(true)}
                className="w-full bg-gradient-to-r from-blue-400 to-blue-500 text-white px-3 py-1.5 rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
              >
                Create File
              </button>
              <button
                onClick={() => setIsCreateFolderModalOpen(true)}
                className="w-full bg-gradient-to-r from-green-400 to-green-500 text-white px-3 py-1.5 rounded-lg font-medium hover:from-green-500 hover:to-green-600 transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-300 text-sm"
              >
                Create Folder
              </button>
              <button
                onClick={() => setIsCommitModalOpen(true)}
                className="w-full bg-gradient-to-r from-purple-400 to-purple-500 text-white px-3 py-1.5 rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm"
              >
                Commit Changes
              </button>
            </div>
          </div>

          <div className="lg:w-7/12 flex flex-col gap-1">
            {loading ? (
              <div className="flex items-center justify-center h-[70vh] bg-gray-100 rounded-2xl">
                <svg
                  className="animate-spin h-8 w-8 text-blue-400"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
                  />
                </svg>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-[70vh] bg-gray-100 rounded-2xl">
                <p className="text-red-500 text-base">Failed to load project: {error}</p>
              </div>
            ) : selectedItem?.type === "file" ? (
              <>
                <div className="bg-black shadow-sm rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
                    <span className="text-sm font-medium text-gray-200 flex items-center">
                      <CodeBracketIcon className="w-4 h-4 mr-2 text-gray-400" />
                      {selectedItem.path}
                    </span>
                  </div>
                  <MonacoEditor
                    height="50vh"
                    language={getFileTypeInfo(selectedItem.path).language}
                    value={fileContent}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    options={{
                      theme: 'vs-dark',
                      fontSize: 14,
                      automaticLayout: true,
                      minimap: { enabled: false },
                      wordWrap: 'on',
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
                      padding: { top: 12, bottom: 12 },
                      lineNumbers: 'on',
                      glyphMargin: true,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  />
                </div>
                <div className="bg-white shadow-sm rounded-2xl p-4 mt-1">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Execution Input</h3>
                  <textarea
                    placeholder="Enter input for your program (e.g., for stdin)"
                    value={executionInput}
                    onChange={(e) => setExecutionInput(e.target.value)}
                    className="border p-2 rounded w-full h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="bg-white shadow-sm rounded-2xl p-4 mt-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">Execution Results</h3>
                    {(executionResult || executionError) && (
                      <button
                        onClick={() => {
                          setExecutionResult(null);
                          setExecutionError(null);
                        }}
                        className="text-sm text-blue-500 hover:text-blue-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {executionLoading && (
                    <div className="flex items-center space-x-2 text-gray-500">
                      <svg
                        className="animate-spin h-5 w-5 text-blue-400"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
                        />
                      </svg>
                      <span>Executing...</span>
                    </div>
                  )}
                  {executionError && <p className="text-red-500 text-sm">{executionError}</p>}
                  {executionResult && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      {executionInput && (
                        <p className="text-sm">
                          <strong>Input (stdin):</strong>
                          <pre className="bg-gray-100 p-2 rounded mt-1 text-sm text-gray-800">
                            {executionInput}
                          </pre>
                        </p>
                      )}
                      <p className="text-sm">
                        <strong>Status:</strong> {executionResult.status?.description}
                      </p>
                      {executionResult.stdout && (
                        <p className="text-sm mt-2">
                          <strong>Output (stdout):</strong>
                          <pre className="bg-gray-100 p-2 rounded mt-1 text-sm text-gray-800">
                            {executionResult.stdout}
                          </pre>
                        </p>
                      )}
                      {executionResult.stderr && (
                        <p className="text-sm mt-2">
                          <strong>Error (stderr):</strong>
                          <pre className="bg-red-50 p-2 rounded mt-1 text-sm text-red-600">
                            {executionResult.stderr}
                          </pre>
                        </p>
                      )}
                      <p className="text-sm mt-2">
                        <strong>Exit Code:</strong> {executionResult.exit_code ?? 'N/A'}
                      </p>
                      <p className="text-sm mt-2">
                        <strong>Time:</strong> {executionResult.time ? `${executionResult.time} s` : 'N/A'}
                      </p>
                      <p className="text-sm mt-2">
                        <strong>Memory:</strong> {executionResult.memory ? `${executionResult.memory} KB` : 'N/A'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[70vh] bg-gray-100 rounded-2xl">
                <p className="text-gray-500 text-base">Select a file to edit</p>
              </div>
            )}
          </div>

          <div
            className={`lg:w-1/4 bg-white shadow-sm rounded-2xl p-4 transition-all duration-300 ease-in-out ml-0 border border-gray-100`}
          >
            <h2 className="text-base font-semibold text-gray-900 mb-3">Collaboration Chat</h2>
            <ChatBox projectId={projectId} username={userId} />
          </div>
        </div>
      </div>

      {isCreateFileModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Create a New File</h3>
            <input
              type="text"
              placeholder="File Name (e.g., script.js)"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 mb-6"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsCreateFileModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                className="bg-gradient-to-r from-blue-400 to-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Create a New Folder</h3>
            <input
              type="text"
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all duration-200 mb-6"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsCreateFolderModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="bg-gradient-to-r from-green-400 to-green-500 text-white px-4 py-2 rounded-lg font-medium hover:from-green-500 hover:to-green-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-green-300"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {isCommitModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Commit Changes to GitHub</h3>
            <input
              type="text"
              placeholder="Commit Message (e.g., Update mergeSort.js)"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-200 mb-6"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsCommitModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                className="bg-gradient-to-r from-purple-400 to-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                Commit
              </button>
            </div>
          </div>
        </div>
      )}

      {isLeaveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Uncommitted Changes</h3>
            <p className="text-sm text-gray-600 mb-6">
              You have uncommitted changes. Would you like to commit them before leaving?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => handleLeaveConfirm(false)}
                className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg transition-all duration-200"
              >
                Leave Without Committing
              </button>
              <button
                onClick={() => handleLeaveConfirm(true)}
                className="bg-gradient-to-r from-purple-400 to-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                Commit and Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Delete {itemToDelete.type === "file" ? "File" : "Folder"}</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "{itemToDelete.name}"?{" "}
              {itemToDelete.type === "folder" && "This will delete all contents inside the folder."}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setItemToDelete(null);
                }}
                className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                className="bg-gradient-to-r from-red-400 to-red-500 text-white px-4 py-2 rounded-lg font-medium hover:from-red-500 hover:to-red-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectWorkspace;