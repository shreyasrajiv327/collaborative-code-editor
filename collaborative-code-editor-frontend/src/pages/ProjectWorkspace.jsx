import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MonacoEditor from '@monaco-editor/react';
import ChatBox from '../components/ChatBox';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import debounce from 'lodash/debounce';
import { toast } from 'react-toastify';
import useExecuteCode from './ExecutionProject';
import Navbar from '../components/Navbar';
import {
  FolderIcon,
  DocumentIcon,
  PlayIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeBracketIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modifiedFiles, setModifiedFiles] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
  const userId = localStorage.getItem('githubLogin');

  const getFileTypeInfo = (filePath) => {
    if (!filePath) return { language: 'plaintext', judge0Language: null };
    const extension = filePath.split('.').pop().toLowerCase();
    const languageMap = {
      js: { language: 'javascript', judge0Language: 'javascript' },
      py: { language: 'python', judge0Language: 'python3' },
      html: { language: 'html', judge0Language: null },
      css: { language: 'css', judge0Language: null },
      json: { language: 'json', judge0Language: null },
      md: { language: 'markdown', judge0Language: null },
      ts: { language: 'typescript', judge0Language: 'typescript' },
      java: { language: 'java', judge0Language: 'java' },
      c: { language: 'c', judge0Language: 'c' },
      cpp: { language: 'cpp', judge0Language: 'cpp' },
    };
    return languageMap[extension] || { language: 'plaintext', judge0Language: null };
  };

  const sendEditorChange = useCallback(
    debounce((value) => {
      if (stompClient.current?.connected && currentFile) {
        const message = {
          projectId,
          senderId: userId,
          type: 'edit',
          content: value,
          timestamp: Date.now(),
        };
        try {
          stompClient.current.publish({
            destination: `/app/collaborate/${projectId}/${currentFile}`,
            body: JSON.stringify(message),
          });
        } catch (e) {
          console.error('Failed to send edit:', e);
          toast.error('Failed to sync changes', { position: 'top-right' });
        }
      }
    }, 300),
    [projectId, currentFile, userId]
  );

  useEffect(() => {
    const socket = new SockJS('http://localhost:8080/ws');
    stompClient.current = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log('WebSocket connected');
        stompClient.current.publish({
          destination: `/app/join/${projectId}/`,
          body: JSON.stringify(userId),
        });
        stompClient.current.subscribe(`/topic/session/${projectId}`, (message) => {
          console.log('Session update:', message.body);
        });
        if (currentFile) {
          subscribeToFileUpdates();
          requestInitialCode();
        }
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
        toast.error('Collaboration connection error', { position: 'top-right' });
      },
      onWebSocketClose: () => {
        console.warn('WebSocket closed');
        toast.warn('Collaboration disconnected. Reconnecting...', { position: 'top-right' });
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
        console.log('WebSocket deactivated');
      }
    };
  }, [projectId, userId]);

  useEffect(() => {
    if (stompClient.current?.connected && projectId && currentFile) {
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
  }, [currentFile, projectId]);

  const subscribeToFileUpdates = () => {
    if (!stompClient.current?.connected) return;
    subscriptionRef.current = stompClient.current.subscribe(
      `/topic/collaboration/${projectId}/${currentFile}`,
      (message) => {
        try {
          const collaborationMessage = JSON.parse(message.body);
          const newContent = collaborationMessage.content || '';
          setFileContent(newContent);
          if (editorRef.current) {
            const position = editorRef.current.getPosition();
            const currentValue = editorRef.current.getValue();
            if (currentValue !== newContent) {
              editorRef.current.setValue(newContent);
              editorRef.current.setPosition(position);
            }
          }
          const updatedFiles = updateFileByPath(files, currentFile, (file) => ({
            ...file,
            content: newContent,
          }));
          setFiles(updatedFiles);
        } catch (e) {
          console.error('Error parsing collaboration message:', e);
          toast.error('Failed to sync file changes', { position: 'top-right' });
        }
      }
    );
  };

  const requestInitialCode = () => {
    if (stompClient.current?.connected && currentFile) {
      stompClient.current.publish({
        destination: `/app/requestCode/${projectId}/${currentFile}`,
        body: JSON.stringify({ userId }),
      });
    }
  };

  useEffect(() => {
    const fetchProjectData = async () => {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams(location.search);
      const owner = queryParams.get('owner');
      const accessToken = localStorage.getItem('token');
      const repo = projectId;
      const branch = 'main';

      if (!owner || !accessToken) {
        toast.error('Authentication missing. Please log in again.', { position: 'top-right' });
        navigate('/');
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
        console.log('Fetched files:', fileData);

        const fileTree = buildFileTree(fileData);
        const projectData = {
          id: projectId,
          name: repo,
          description: fileData['README.md']?.split('\n')[1] || `Description for ${repo}`,
          files: fileTree,
          owner,
          repo,
        };

        setProject(projectData);
        setFiles(projectData.files || []);

        const initialExpanded = {};
        const collectFolders = (fileList) => {
          fileList.forEach((file) => {
            if (file.type === 'folder') {
              initialExpanded[file.path] = true;
              if (file.children) collectFolders(file.children);
            }
          });
        };
        collectFolders(projectData.files);
        setExpandedFolders(initialExpanded);

        const firstFile =
          findFileByPath(projectData.files, 'index.js') ||
          projectData.files.find((f) => f.type === 'file');

        if (firstFile) {
          setCurrentFile(firstFile.path);
          setFileContent(firstFile.content || '');
        }
      } catch (err) {
        setError(err.message);
        toast.error(`Failed to load project: ${err.message}`, { position: 'top-right' });
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId, navigate, location.search]);

  const handleEditorChange = (value) => {
    setFileContent(value);
    sendEditorChange(value);
    setModifiedFiles((prev) => ({
      ...prev,
      [currentFile]: value,
    }));
    const updatedFiles = updateFileByPath(files, currentFile, (file) => ({
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
    const owner = queryParams.get('owner');
    const accessToken = localStorage.getItem('token');
    const repo = projectId;
    const branch = 'main';

    const filesWithPaths = {};
    const allFiles = collectAllFiles(files);
    allFiles.forEach((file) => {
      if (modifiedFiles[file.path] && modifiedFiles[file.path] !== file.originalContent) {
        filesWithPaths[file.path] = modifiedFiles[file.path];
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

      const response = await fetch('http://localhost:8080/api/github/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(commitRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to commit: ${response.statusText}`);
      }

      toast.success('✅ Commit successful', { position: 'top-right' });
      setCommitMessage('');
      setIsCommitModalOpen(false);
      setModifiedFiles({});
    } catch (err) {
      toast.error(`Error committing: ${err.message}`, { position: 'top-right' });
    }
  };

  const leaveWorkspace = () => {
    if (stompClient.current?.connected) {
      stompClient.current.publish({
        destination: `/app/leave/${projectId}/`,
        body: JSON.stringify(userId),
      });
    }
    navigate('/projects');
  };

  const buildFileTree = (fileData) => {
    const tree = [];
    const folders = {};

    Object.entries(fileData).forEach(([path, content]) => {
      const parts = path.split('/');
      let currentLevel = tree;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (index === parts.length - 1) {
          currentLevel.push({
            name: part,
            type: 'file',
            path: currentPath,
            content: content || '',
            originalContent: content || '',
          });
        } else {
          if (!folders[currentPath]) {
            const folder = {
              name: part,
              type: 'folder',
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
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });

    const sortedTree = sortTree(tree);
    sortedTree.forEach((item) => {
      if (item.type === 'folder') {
        item.children = sortTree(item.children);
      }
    });

    return sortedTree;
  };

  const collectAllFiles = (fileList) => {
    const allFiles = [];
    fileList.forEach((item) => {
      if (item.type === 'file') allFiles.push(item);
      else if (item.type === 'folder' && item.children) {
        allFiles.push(...collectAllFiles(item.children));
      }
    });
    return allFiles;
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    if (currentFile) {
      const { language } = getFileTypeInfo(currentFile);
      monaco.editor.setModelLanguage(editor.getModel(), language);
      monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: ['.'],
        provideCompletionItems: (model, position) => {
          const suggestions =
            language === 'javascript'
              ? [
                  {
                    label: 'consoleLog',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'console.log(${1:msg});',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Log to console',
                  },
                  {
                    label: 'function',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'function ${1:name}(${2:params}) {\n  ${3}\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Function declaration',
                  },
                  {
                    label: 'arrowFunc',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'const ${1:name} = (${2:params}) => {\n  ${3}\n};',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Arrow function',
                  },
                ]
              : language === 'python'
              ? [
                  {
                    label: 'print',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'print(${1:msg})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Print to console',
                  },
                  {
                    label: 'def',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'def ${1:name}(${2:params}):\n    ${3:pass}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Function definition',
                  },
                  {
                    label: 'class',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'class ${1:Name}:\n    def __init__(self):\n        ${2:pass}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Class definition',
                  },
                ]
              : [];
          return { suggestions };
        },
      });
    }
  };

  const findFileByPath = (fileList, filePath) => {
    for (const item of fileList) {
      if (item.type === 'file' && item.path === filePath) return item;
      if (item.type === 'folder' && item.children) {
        const found = findFileByPath(item.children, filePath);
        if (found) return found;
      }
    }
    return null;
  };

  const updateFileByPath = (fileList, targetPath, updateFn) => {
    return fileList.map((item) => {
      if (item.path === targetPath) return updateFn(item);
      if (item.type === 'folder' && item.children) {
        return {
          ...item,
          children: updateFileByPath(item.children, targetPath, updateFn),
        };
      }
      return item;
    });
  };

  const handleFileClick = (filePath) => {
    setCurrentFile(filePath);
    const file = findFileByPath(files, filePath);
    const content = modifiedFiles[filePath] || file?.content || '';
    setFileContent(content);
    if (editorRef.current) {
      const { language } = getFileTypeInfo(filePath);
      window.monaco.editor.setModelLanguage(editorRef.current.getModel(), language);
      editorRef.current.setValue(content);
    }
    setExecutionResult(null);
    setExecutionError(null);
  };

  const handleFolderClick = (folder) => {
    setSelectedFolder(folder);
    setNewFileName('');
    setIsCreateFileModalOpen(true);
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const toggleAllFolders = (expand) => {
    const newExpanded = {};
    const collectFolders = (fileList) => {
      fileList.forEach((file) => {
        if (file.type === 'folder') {
          newExpanded[file.path] = expand;
          if (file.children) collectFolders(file.children);
        }
      });
    };
    collectFolders(files);
    setExpandedFolders(newExpanded);
  };

  const handleCreateFile = () => {
    if (!newFileName) {
      toast.error('Please enter a file name', { position: 'top-right' });
      return;
    }
    let updatedFiles = [...files];
    const newFileContent = '';
    if (selectedFolder) {
      const newFilePath = `${selectedFolder.path}/${newFileName}`;
      const newFile = {
        name: newFileName,
        type: 'file',
        path: newFilePath,
        content: newFileContent,
        originalContent: newFileContent,
      };
      updatedFiles = updateFileByPath(updatedFiles, selectedFolder.path, (folder) => ({
        ...folder,
        children: [...(folder.children || []), newFile],
      }));
    } else {
      updatedFiles.push({
        name: newFileName,
        type: 'file',
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
    setNewFileName('');
    setIsCreateFileModalOpen(false);
    toast.success(`File ${newFileName} created`, { position: 'top-right' });
  };

  const handleCreateFolder = () => {
    if (!newFolderName) {
      toast.error('Please enter a folder name', { position: 'top-right' });
      return;
    }
    const updatedFiles = [
      ...files,
      {
        name: newFolderName,
        type: 'folder',
        path: newFolderName,
        children: [],
      },
    ];
    setFiles(updatedFiles);
    setExpandedFolders((prev) => ({
      ...prev,
      [newFolderName]: true,
    }));
    setNewFolderName('');
    setIsCreateFolderModalOpen(false);
    toast.success(`Folder ${newFolderName} created`, { position: 'top-right' });
  };

  const renderFileTree = (fileList) =>
    fileList.map((file) =>
      file.type === 'file' ? (
        <li
          key={file.path}
          className="flex items-center pl-4 py-1.5 hover:bg-gray-200 rounded-lg transition-all duration-200 ease-in-out"
        >
          <DocumentIcon className="w-4 h-4 text-gray-400 mr-2" />
          <span
            className={`cursor-pointer flex-1 text-sm font-medium ${
              currentFile === file.path
                ? 'bg-blue-50 text-blue-600 rounded-lg px-2 py-1'
                : 'text-gray-600 hover:text-blue-500'
            }`}
            onClick={() => handleFileClick(file.path)}
          >
            {file.name}
          </span>
          {getFileTypeInfo(file.path).judge0Language && (
            <button
              onClick={() => {
                const fileData = findFileByPath(files, file.path);
                executeCode(
                  file.path,
                  fileData.content,
                  projectId,
                  userId,
                  getFileTypeInfo(file.path).judge0Language
                );
              }}
              disabled={executionLoading}
              className={`text-orange-400 hover:text-orange-500 p-1 rounded-full transition-all duration-200 ease-in-out ${
                executionLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Execute file"
            >
              <PlayIcon className="w-4 h-4" />
            </button>
          )}
        </li>
      ) : (
        <li key={file.path}>
          <div className="flex items-center pl-4 py-1.5 hover:bg-gray-200 rounded-lg transition-all duration-200 ease-in-out">
            <div
              className="flex items-center cursor-pointer text-gray-600 hover:text-gray-800 flex-1"
              onClick={() => toggleFolder(file.path)}
            >
              {expandedFolders[file.path] ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 mr-2" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-gray-400 mr-2" />
              )}
              <FolderIcon className="w-4 h-4 text-gray-400 mr-2" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
            <button
              onClick={() => handleFolderClick(file)}
              className="text-green-400 hover:text-green-500 p-1 rounded-full transition-all duration-200 ease-in-out"
              title="Add file to folder"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          {expandedFolders[file.path] && file.children && file.children.length > 0 && (
            <ul className="pl-4">{renderFileTree(file.children)}</ul>
          )}
        </li>
      )
    );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
    <Navbar />
    <div className="w-full px-0 py-12">
      {/* Header */}
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
          className="flex items-center text-sm text-gray-600 hover:text-red-500 transition-all duration-200 ease-in-out"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Leave Workspace
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-1">
        {/* Left Sidebar - File Tree */}
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
              onClick={() => {
                setSelectedFolder(null);
                setIsCreateFileModalOpen(true);
              }}
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

        {/* Center - Code Editor and Execution Results */}
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
          ) : currentFile ? (
            <>
              <div className="bg-black shadow-sm rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
                  <span className="text-sm font-medium text-gray-200 flex items-center">
                    <CodeBracketIcon className="w-4 h-4 mr-2 text-gray-400" />
                    {currentFile}
                  </span>
                </div>
                <MonacoEditor
                  height="50vh"
                  language={getFileTypeInfo(currentFile).language}
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
              <div className="bg-white shadow-sm rounded-2xl p-4">
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

        {/* Right Sidebar - Chat */}
        <div
          className={`lg:w-1/4 bg-white shadow-sm rounded-2xl p-4 transition-all duration-300 ease-in-out ml-0 border border-gray-100`}
        >
          <h2 className="text-base font-semibold text-gray-900 mb-3">Collaboration Chat</h2>
          <ChatBox projectId={projectId} username={userId} />
        </div>
      </div>
    </div>


      {/* Modals */}
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
    </div>
  );
};

export default ProjectWorkspace;

// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import MonacoEditor from '@monaco-editor/react';
// import ChatBox from '../components/ChatBox';
// import SockJS from 'sockjs-client';
// import { Client } from '@stomp/stompjs';
// import debounce from 'lodash/debounce';
// import { toast } from 'react-toastify';
// import useExecuteCode from './ExecutionProject';
// import Navbar from '../components/Navbar';
// import {
//   FolderIcon,
//   DocumentIcon,
//   PlayIcon,
//   PlusIcon,
//   ChevronDownIcon,
//   ChevronRightIcon,
//   CodeBracketIcon,
//   ArrowLeftIcon,
// } from '@heroicons/react/24/outline';

// const ProjectWorkspace = () => {
//   const { projectId } = useParams();
//   const navigate = useNavigate();
//   const location = useLocation();
//   const [project, setProject] = useState(null);
//   const [files, setFiles] = useState([]);
//   const [currentFile, setCurrentFile] = useState(null);
//   const [fileContent, setFileContent] = useState('');
//   const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false);
//   const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
//   const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
//   const [newFileName, setNewFileName] = useState('');
//   const [newFolderName, setNewFolderName] = useState('');
//   const [commitMessage, setCommitMessage] = useState('');
//   const [selectedFolder, setSelectedFolder] = useState(null);
//   const [expandedFolders, setExpandedFolders] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [modifiedFiles, setModifiedFiles] = useState({});
//   const [isSidebarOpen, setIsSidebarOpen] = useState(true);
//   const {
//     executeCode,
//     executionResult,
//     executionLoading,
//     executionError,
//     setExecutionResult,
//     setExecutionError,
//   } = useExecuteCode();

//   const stompClient = useRef(null);
//   const editorRef = useRef(null);
//   const subscriptionRef = useRef(null);
//   const userId = localStorage.getItem('githubLogin');

//   const getFileTypeInfo = (filePath) => {
//     if (!filePath) return { language: 'plaintext', judge0Language: null };
//     const extension = filePath.split('.').pop().toLowerCase();
//     const languageMap = {
//       js: { language: 'javascript', judge0Language: 'javascript' },
//       py: { language: 'python', judge0Language: 'python3' },
//       html: { language: 'html', judge0Language: null },
//       css: { language: 'css', judge0Language: null },
//       json: { language: 'json', judge0Language: null },
//       md: { language: 'markdown', judge0Language: null },
//       ts: { language: 'typescript', judge0Language: 'typescript' },
//       java: { language: 'java', judge0Language: 'java' },
//       c: { language: 'c', judge0Language: 'c' },
//       cpp: { language: 'cpp', judge0Language: 'cpp' },
//     };
//     return languageMap[extension] || { language: 'plaintext', judge0Language: null };
//   };

//   const sendEditorChange = useCallback(
//     debounce((value) => {
//       if (stompClient.current?.connected && currentFile) {
//         const message = {
//           projectId,
//           senderId: userId,
//           type: 'edit',
//           content: value,
//           timestamp: Date.now(),
//         };
//         try {
//           stompClient.current.publish({
//             destination: `/app/collaborate/${projectId}/${currentFile}`,
//             body: JSON.stringify(message),
//           });
//         } catch (e) {
//           console.error('Failed to send edit:', e);
//           toast.error('Failed to sync changes', { position: 'top-right' });
//         }
//       }
//     }, 300),
//     [projectId, currentFile, userId]
//   );

//   useEffect(() => {
//     const socket = new SockJS('http://localhost:8080/ws');
//     stompClient.current = new Client({
//       webSocketFactory: () => socket,
//       reconnectDelay: 5000,
//       onConnect: () => {
//         console.log('WebSocket connected');
//         stompClient.current.publish({
//           destination: `/app/join/${projectId}/`,
//           body: JSON.stringify(userId),
//         });
//         stompClient.current.subscribe(`/topic/session/${projectId}`, (message) => {
//           console.log('Session update:', message.body);
//         });
//         if (currentFile) {
//           subscribeToFileUpdates();
//           requestInitialCode();
//         }
//       },
//       onStompError: (frame) => {
//         console.error('STOMP error:', frame);
//         toast.error('Collaboration connection error', { position: 'top-right' });
//       },
//       onWebSocketClose: () => {
//         console.warn('WebSocket closed');
//         toast.warn('Collaboration disconnected. Reconnecting...', { position: 'top-right' });
//       },
//     });

//     stompClient.current.activate();

//     return () => {
//       if (stompClient.current) {
//         if (stompClient.current.connected) {
//           stompClient.current.publish({
//             destination: `/app/leave/${projectId}/`,
//             body: JSON.stringify(userId),
//           });
//         }
//         stompClient.current.deactivate();
//         console.log('WebSocket deactivated');
//       }
//     };
//   }, [projectId, userId]);

//   useEffect(() => {
//     if (stompClient.current?.connected && projectId && currentFile) {
//       if (subscriptionRef.current) {
//         subscriptionRef.current.unsubscribe();
//       }
//       subscribeToFileUpdates();
//       requestInitialCode();
//     }

//     return () => {
//       if (subscriptionRef.current) {
//         subscriptionRef.current.unsubscribe();
//       }
//     };
//   }, [currentFile, projectId]);

//   const subscribeToFileUpdates = () => {
//     if (!stompClient.current?.connected) return;
//     subscriptionRef.current = stompClient.current.subscribe(
//       `/topic/collaboration/${projectId}/${currentFile}`,
//       (message) => {
//         try {
//           const collaborationMessage = JSON.parse(message.body);
//           const newContent = collaborationMessage.content || '';
//           setFileContent(newContent);
//           if (editorRef.current) {
//             const position = editorRef.current.getPosition();
//             const currentValue = editorRef.current.getValue();
//             if (currentValue !== newContent) {
//               editorRef.current.setValue(newContent);
//               editorRef.current.setPosition(position);
//             }
//           }
//           const updatedFiles = updateFileByPath(files, currentFile, (file) => ({
//             ...file,
//             content: newContent,
//           }));
//           setFiles(updatedFiles);
//         } catch (e) {
//           console.error('Error parsing collaboration message:', e);
//           toast.error('Failed to sync file changes', { position: 'top-right' });
//         }
//       }
//     );
//   };

//   const requestInitialCode = () => {
//     if (stompClient.current?.connected && currentFile) {
//       stompClient.current.publish({
//         destination: `/app/requestCode/${projectId}/${currentFile}`,
//         body: JSON.stringify({ userId }),
//       });
//     }
//   };

//   useEffect(() => {
//     const fetchProjectData = async () => {
//       setLoading(true);
//       setError(null);
//       const queryParams = new URLSearchParams(location.search);
//       const owner = queryParams.get('owner');
//       const accessToken = localStorage.getItem('token');
//       const repo = projectId;
//       const branch = 'main';

//       if (!owner || !accessToken) {
//         toast.error('Authentication missing. Please log in again.', { position: 'top-right' });
//         navigate('/');
//         return;
//       }

//       try {
//         const params = new URLSearchParams({ owner, repo, branch });
//         const response = await fetch(`/api/github/files?${params.toString()}`, {
//           headers: {
//             Authorization: `Bearer ${accessToken}`,
//           },
//         });

//         if (!response.ok) {
//           throw new Error(`API Error: ${response.statusText}`);
//         }

//         const fileData = await response.json();
//         console.log('Fetched files:', fileData);

//         const fileTree = buildFileTree(fileData);
//         const projectData = {
//           id: projectId,
//           name: repo,
//           description: fileData['README.md']?.split('\n')[1] || `Description for ${repo}`,
//           files: fileTree,
//           owner,
//           repo,
//         };

//         setProject(projectData);
//         setFiles(projectData.files || []);

//         const initialExpanded = {};
//         const collectFolders = (fileList) => {
//           fileList.forEach((file) => {
//             if (file.type === 'folder') {
//               initialExpanded[file.path] = true;
//               if (file.children) collectFolders(file.children);
//             }
//           });
//         };
//         collectFolders(projectData.files);
//         setExpandedFolders(initialExpanded);

//         const firstFile =
//           findFileByPath(projectData.files, 'index.js') ||
//           projectData.files.find((f) => f.type === 'file');

//         if (firstFile) {
//           setCurrentFile(firstFile.path);
//           setFileContent(firstFile.content || '');
//         }
//       } catch (err) {
//         setError(err.message);
//         toast.error(`Failed to load project: ${err.message}`, { position: 'top-right' });
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchProjectData();
//   }, [projectId, navigate, location.search]);

//   const handleEditorChange = (value) => {
//     setFileContent(value);
//     sendEditorChange(value);
//     setModifiedFiles((prev) => ({
//       ...prev,
//       [currentFile]: value,
//     }));
//     const updatedFiles = updateFileByPath(files, currentFile, (file) => ({
//       ...file,
//       content: value,
//     }));
//     setFiles(updatedFiles);
//   };

//   const handleCommit = async () => {
//     if (!commitMessage) {
//       toast.error('Please enter a commit message', { position: 'top-right' });
//       return;
//     }
//     const queryParams = new URLSearchParams(location.search);
//     const owner = queryParams.get('owner');
//     const accessToken = localStorage.getItem('token');
//     const repo = projectId;
//     const branch = 'main';

//     const filesWithPaths = {};
//     const allFiles = collectAllFiles(files);
//     allFiles.forEach((file) => {
//       if (modifiedFiles[file.path] && modifiedFiles[file.path] !== file.originalContent) {
//         filesWithPaths[file.path] = modifiedFiles[file.path];
//       }
//     });

//     if (Object.keys(filesWithPaths).length === 0) {
//       toast.error('No changes to commit', { position: 'top-right' });
//       return;
//     }

//     try {
//       const commitRequest = {
//         owner,
//         repo,
//         filesWithPaths,
//         commitMessage,
//         branch,
//       };

//       const response = await fetch('http://localhost:8080/api/github/commit', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${accessToken}`,
//         },
//         body: JSON.stringify(commitRequest),
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to commit: ${response.statusText}`);
//       }

//       toast.success('✅ Commit successful', { position: 'top-right' });
//       setCommitMessage('');
//       setIsCommitModalOpen(false);
//       setModifiedFiles({});
//     } catch (err) {
//       toast.error(`Error committing: ${err.message}`, { position: 'top-right' });
//     }
//   };

//   const leaveWorkspace = () => {
//     if (stompClient.current?.connected) {
//       stompClient.current.publish({
//         destination: `/app/leave/${projectId}/`,
//         body: JSON.stringify(userId),
//       });
//     }
//     navigate('/projects');
//   };

//   const buildFileTree = (fileData) => {
//     const tree = [];
//     const folders = {};

//     Object.entries(fileData).forEach(([path, content]) => {
//       const parts = path.split('/');
//       let currentLevel = tree;
//       let currentPath = '';

//       parts.forEach((part, index) => {
//         currentPath = currentPath ? `${currentPath}/${part}` : part;

//         if (index === parts.length - 1) {
//           currentLevel.push({
//             name: part,
//             type: 'file',
//             path: currentPath,
//             content: content || '',
//             originalContent: content || '',
//           });
//         } else {
//           if (!folders[currentPath]) {
//             const folder = {
//               name: part,
//               type: 'folder',
//               path: currentPath,
//               children: [],
//             };
//             folders[currentPath] = folder;
//             currentLevel.push(folder);
//             currentLevel = folder.children;
//           } else {
//             currentLevel = folders[currentPath].children;
//           }
//         }
//       });
//     });

//     const sortTree = (items) =>
//       items.sort((a, b) => {
//         if (a.type === 'folder' && b.type === 'file') return -1;
//         if (a.type === 'file' && b.type === 'folder') return 1;
//         return a.name.localeCompare(b.name);
//       });

//     const sortedTree = sortTree(tree);
//     sortedTree.forEach((item) => {
//       if (item.type === 'folder') {
//         item.children = sortTree(item.children);
//       }
//     });

//     return sortedTree;
//   };

//   const collectAllFiles = (fileList) => {
//     const allFiles = [];
//     fileList.forEach((item) => {
//       if (item.type === 'file') allFiles.push(item);
//       else if (item.type === 'folder' && item.children) {
//         allFiles.push(...collectAllFiles(item.children));
//       }
//     });
//     return allFiles;
//   };

//   const handleEditorDidMount = (editor, monaco) => {
//     editorRef.current = editor;
//     if (currentFile) {
//       const { language } = getFileTypeInfo(currentFile);
//       monaco.editor.setModelLanguage(editor.getModel(), language);
//       monaco.languages.registerCompletionItemProvider(language, {
//         triggerCharacters: ['.'],
//         provideCompletionItems: (model, position) => {
//           const suggestions =
//             language === 'javascript'
//               ? [
//                   {
//                     label: 'consoleLog',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'console.log(${1:msg});',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Log to console',
//                   },
//                   {
//                     label: 'function',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'function ${1:name}(${2:params}) {\n  ${3}\n}',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Function declaration',
//                   },
//                   {
//                     label: 'arrowFunc',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'const ${1:name} = (${2:params}) => {\n  ${3}\n};',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Arrow function',
//                   },
//                 ]
//               : language === 'python'
//               ? [
//                   {
//                     label: 'print',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'print(${1:msg})',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Print to console',
//                   },
//                   {
//                     label: 'def',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'def ${1:name}(${2:params}):\n    ${3:pass}',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Function definition',
//                   },
//                   {
//                     label: 'class',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'class ${1:Name}:\n    def __init__(self):\n        ${2:pass}',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Class definition',
//                   },
//                 ]
//               : [];
//           return { suggestions };
//         },
//       });
//     }
//   };

//   const findFileByPath = (fileList, filePath) => {
//     for (const item of fileList) {
//       if (item.type === 'file' && item.path === filePath) return item;
//       if (item.type === 'folder' && item.children) {
//         const found = findFileByPath(item.children, filePath);
//         if (found) return found;
//       }
//     }
//     return null;
//   };

//   const updateFileByPath = (fileList, targetPath, updateFn) => {
//     return fileList.map((item) => {
//       if (item.path === targetPath) return updateFn(item);
//       if (item.type === 'folder' && item.children) {
//         return {
//           ...item,
//           children: updateFileByPath(item.children, targetPath, updateFn),
//         };
//       }
//       return item;
//     });
//   };

//   const handleFileClick = (filePath) => {
//     setCurrentFile(filePath);
//     const file = findFileByPath(files, filePath);
//     const content = modifiedFiles[filePath] || file?.content || '';
//     setFileContent(content);
//     if (editorRef.current) {
//       const { language } = getFileTypeInfo(filePath);
//       window.monaco.editor.setModelLanguage(editorRef.current.getModel(), language);
//       editorRef.current.setValue(content);
//     }
//     setExecutionResult(null);
//     setExecutionError(null);
//   };

//   const handleFolderClick = (folder) => {
//     setSelectedFolder(folder);
//     setNewFileName('');
//     setIsCreateFileModalOpen(true);
//   };

//   const toggleFolder = (folderPath) => {
//     setExpandedFolders((prev) => ({
//       ...prev,
//       [folderPath]: !prev[folderPath],
//     }));
//   };

//   const toggleAllFolders = (expand) => {
//     const newExpanded = {};
//     const collectFolders = (fileList) => {
//       fileList.forEach((file) => {
//         if (file.type === 'folder') {
//           newExpanded[file.path] = expand;
//           if (file.children) collectFolders(file.children);
//         }
//       });
//     };
//     collectFolders(files);
//     setExpandedFolders(newExpanded);
//   };

//   const handleCreateFile = () => {
//     if (!newFileName) {
//       toast.error('Please enter a file name', { position: 'top-right' });
//       return;
//     }
//     let updatedFiles = [...files];
//     const newFileContent = '';
//     if (selectedFolder) {
//       const newFilePath = `${selectedFolder.path}/${newFileName}`;
//       const newFile = {
//         name: newFileName,
//         type: 'file',
//         path: newFilePath,
//         content: newFileContent,
//         originalContent: newFileContent,
//       };
//       updatedFiles = updateFileByPath(updatedFiles, selectedFolder.path, (folder) => ({
//         ...folder,
//         children: [...(folder.children || []), newFile],
//       }));
//     } else {
//       updatedFiles.push({
//         name: newFileName,
//         type: 'file',
//         path: newFileName,
//         content: newFileContent,
//         originalContent: newFileContent,
//       });
//     }

//     setFiles(updatedFiles);
//     if (selectedFolder) {
//       setExpandedFolders((prev) => ({
//         ...prev,
//         [selectedFolder.path]: true,
//       }));
//     }
//     setNewFileName('');
//     setIsCreateFileModalOpen(false);
//     toast.success(`File ${newFileName} created`, { position: 'top-right' });
//   };

//   const handleCreateFolder = () => {
//     if (!newFolderName) {
//       toast.error('Please enter a folder name', { position: 'top-right' });
//       return;
//     }
//     const updatedFiles = [
//       ...files,
//       {
//         name: newFolderName,
//         type: 'folder',
//         path: newFolderName,
//         children: [],
//       },
//     ];
//     setFiles(updatedFiles);
//     setExpandedFolders((prev) => ({
//       ...prev,
//       [newFolderName]: true,
//     }));
//     setNewFolderName('');
//     setIsCreateFolderModalOpen(false);
//     toast.success(`Folder ${newFolderName} created`, { position: 'top-right' });
//   };

//   const renderFileTree = (fileList) =>
//     fileList.map((file) =>
//       file.type === 'file' ? (
//         <li
//           key={file.path}
//           className="flex items-center pl-6 py-2 hover:bg-gray-100 rounded-lg transition-all duration-200 ease-in-out"
//         >
//           <DocumentIcon className="w-4 h-4 text-gray-400 mr-2" />
//           <span
//             className={`cursor-pointer flex-1 text-sm font-medium ${
//               currentFile === file.path
//                 ? 'bg-blue-50 text-blue-600 rounded-lg px-2 py-1'
//                 : 'text-gray-600 hover:text-blue-500'
//             }`}
//             onClick={() => handleFileClick(file.path)}
//           >
//             {file.name}
//           </span>
//           {getFileTypeInfo(file.path).judge0Language && (
//             <button
//               onClick={() => {
//                 const fileData = findFileByPath(files, file.path);
//                 executeCode(
//                   file.path,
//                   fileData.content,
//                   projectId,
//                   userId,
//                   getFileTypeInfo(file.path).judge0Language
//                 );
//               }}
//               disabled={executionLoading}
//               className={`text-orange-400 hover:text-orange-500 p-1 rounded-full transition-all duration-200 ease-in-out ${
//                 executionLoading ? 'opacity-50 cursor-not-allowed' : ''
//               }`}
//               title="Execute file"
//             >
//               <PlayIcon className="w-4 h-4" />
//             </button>
//           )}
//         </li>
//       ) : (
//         <li key={file.path}>
//           <div className="flex items-center pl-6 py-2 hover:bg-gray-100 rounded-lg transition-all duration-200 ease-in-out">
//             <div
//               className="flex items-center cursor-pointer text-gray-600 hover:text-gray-800 flex-1"
//               onClick={() => toggleFolder(file.path)}
//             >
//               {expandedFolders[file.path] ? (
//                 <ChevronDownIcon className="w-4 h-4 text-gray-400 mr-2" />
//               ) : (
//                 <ChevronRightIcon className="w-4 h-4 text-gray-400 mr-2" />
//               )}
//               <FolderIcon className="w-4 h-4 text-gray-400 mr-2" />
//               <span className="text-sm font-medium">{file.name}</span>
//             </div>
//             <button
//               onClick={() => handleFolderClick(file)}
//               className="text-green-400 hover:text-green-500 p-1 rounded-full transition-all duration-200 ease-in-out"
//               title="Add file to folder"
//             >
//               <PlusIcon className="w-4 h-4" />
//             </button>
//           </div>
//           {expandedFolders[file.path] && file.children && file.children.length > 0 && (
//             <ul className="pl-4">{renderFileTree(file.children)}</ul>
//           )}
//         </li>
//       )
//     );

//   return (
//     <div className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
//       <Navbar />
//       <div className="container mx-auto px-4 sm:px-6 lg:px-12 py-12">
//         {/* Header */}
//         <div className="mb-6 flex items-center justify-between">
//           <div>
//             <h1 className="text-3xl font-semibold text-gray-900">
//               {project?.name || 'Loading...'}
//             </h1>
//             <div className="h-1 w-24 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full mt-2" />
//             <p className="text-sm text-gray-500 mt-2">{project?.description || ''}</p>
//           </div>
//           <button
//             onClick={leaveWorkspace}
//             className="flex items-center text-sm text-gray-600 hover:text-red-500 transition-all duration-200 ease-in-out"
//           >
//             <ArrowLeftIcon className="w-4 h-4 mr-1" />
//             Leave Workspace
//           </button>
//         </div>

//         <div className="flex flex-col lg:flex-row gap-3">
//           {/* Left Sidebar - File Tree */}
//           <div
//             className={`lg:w-1/4 bg-white shadow-sm rounded-2xl p-6 transition-all duration-300 ease-in-out ${
//               isSidebarOpen ? 'block' : 'hidden lg:block'
//             }`}
//           >
//             <div className="flex items-center justify-between mb-4">
//               <h2 className="text-lg font-semibold text-gray-900">Files</h2>
//               <button
//                 onClick={() => setIsSidebarOpen(!isSidebarOpen)}
//                 className="lg:hidden text-gray-500 hover:text-blue-500 text-sm"
//               >
//                 {isSidebarOpen ? 'Close' : 'Open'}
//               </button>
//             </div>
//             <div className="flex space-x-3 mb-4">
//               <button
//                 onClick={() => toggleAllFolders(true)}
//                 className="text-sm text-blue-500 hover:text-blue-600 transition-all duration-200"
//               >
//                 Expand All
//               </button>
//               <button
//                 onClick={() => toggleAllFolders(false)}
//                 className="text-sm text-blue-500 hover:text-blue-600 transition-all duration-200"
//               >
//                 Collapse All
//               </button>
//             </div>
//             {loading ? (
//               <div className="flex items-center justify-center py-6">
//                 <svg
//                   className="animate-spin h-6 w-6 text-blue-400"
//                   viewBox="0 0 24 24"
//                 >
//                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                   <path
//                     className="opacity-75"
//                     fill="currentColor"
//                     d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
//                   />
//                 </svg>
//               </div>
//             ) : error ? (
//               <p className="text-red-500 text-sm">Error: {error}</p>
//             ) : files.length ? (
//               <ul className="space-y-1">{renderFileTree(files)}</ul>
//             ) : (
//               <p className="text-gray-500 text-sm">No files found</p>
//             )}
//             <div className="mt-6 space-y-3">
//               <button
//                 onClick={() => {
//                   setSelectedFolder(null);
//                   setIsCreateFileModalOpen(true);
//                 }}
//                 className="w-full bg-gradient-to-r from-blue-400 to-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-blue-300"
//               >
//                 Create File
//               </button>
//               <button
//                 onClick={() => setIsCreateFolderModalOpen(true)}
//                 className="w-full bg-gradient-to-r from-green-400 to-green-500 text-white px-4 py-2 rounded-lg font-medium hover:from-green-500 hover:to-green-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-green-300"
//               >
//                 Create Folder
//               </button>
//               <button
//                 onClick={() => setIsCommitModalOpen(true)}
//                 className="w-full bg-gradient-to-r from-purple-400 to-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-purple-300"
//               >
//                 Commit Changes
//               </button>
//             </div>
//           </div>

//           {/* Center - Code Editor and Execution Results */}
//           <div className="lg:w-2/4 flex flex-col gap-3">
//             {loading ? (
//               <div className="flex items-center justify-center h-[70vh] bg-gray-100 rounded-2xl">
//                 <svg
//                   className="animate-spin h-8 w-8 text-blue-400"
//                   viewBox="0 0 24 24"
//                 >
//                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                   <path
//                     className="opacity-75"
//                     fill="currentColor"
//                     d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
//                   />
//                 </svg>
//               </div>
//             ) : error ? (
//               <div className="flex items-center justify-center h-[70vh] bg-gray-100 rounded-2xl">
//                 <p className="text-red-500 text-base">Failed to load project: {error}</p>
//               </div>
//             ) : currentFile ? (
//               <>
//                 <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
//                   <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
//                     <span className="text-sm font-medium text-gray-600 flex items-center">
//                       <CodeBracketIcon className="w-4 h-4 mr-2 text-gray-400" />
//                       {currentFile}
//                     </span>
//                     <div className="flex space-x-3">
//                       <button
//                         onClick={() => editorRef.current?.trigger('editor', 'editor.action.formatDocument')}
//                         className="text-sm text-blue-500 hover:text-blue-600 flex items-center transition-all duration-200"
//                       >
//                         <CodeBracketIcon className="w-4 h-4 mr-1" />
//                         Format
//                       </button>
//                       <button
//                         onClick={() => handleEditorChange(fileContent)}
//                         className="text-sm text-blue-500 hover:text-blue-600 flex items-center transition-all duration-200"
//                       >
//                         <DocumentIcon className="w-4 h-4 mr-1" />
//                         Save
//                       </button>
//                     </div>
//                   </div>
//                   <MonacoEditor
//                     height="50vh"
//                     language={getFileTypeInfo(currentFile).language}
//                     value={fileContent}
//                     onChange={handleEditorChange}
//                     onMount={handleEditorDidMount}
//                     options={{
//                       theme: 'vs',
//                       fontSize: 14,
//                       automaticLayout: true,
//                       minimap: { enabled: false },
//                       wordWrap: 'on',
//                       scrollBeyondLastLine: false,
//                       suggest: {
//                         snippetsPreventQuickSuggestions: false,
//                         suggestions: true,
//                       },
//                       quickSuggestions: {
//                         other: true,
//                         comments: true,
//                         strings: true,
//                       },
//                       padding: { top: 12, bottom: 12 },
//                       lineNumbers: 'on',
//                       glyphMargin: true,
//                       fontFamily: 'Inter, sans-serif',
//                     }}
//                   />
//                 </div>
//                 <div className="bg-white shadow-sm rounded-2xl p-6">
//                   <div className="flex items-center justify-between mb-4">
//                     <h3 className="text-base font-semibold text-gray-900">Execution Results</h3>
//                     {(executionResult || executionError) && (
//                       <button
//                         onClick={() => {
//                           setExecutionResult(null);
//                           setExecutionError(null);
//                         }}
//                         className="text-sm text-blue-500 hover:text-blue-600"
//                       >
//                         Clear
//                       </button>
//                     )}
//                   </div>
//                   {executionLoading && (
//                     <div className="flex items-center space-x-2 text-gray-500">
//                       <svg
//                         className="animate-spin h-5 w-5 text-blue-400"
//                         viewBox="0 0 24 24"
//                       >
//                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                         <path
//                           className="opacity-75"
//                           fill="currentColor"
//                           d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
//                         />
//                       </svg>
//                       <span>Executing...</span>
//                     </div>
//                   )}
//                   {executionError && <p className="text-red-500 text-sm">{executionError}</p>}
//                   {executionResult && (
//                     <div className="bg-gray-50 p-4 rounded-lg">
//                       <p className="text-sm">
//                         <strong>Status:</strong> {executionResult.status?.description}
//                       </p>
//                       {executionResult.stdout && (
//                         <p className="text-sm mt-2">
//                           <strong>Output (stdout):</strong>
//                           <pre className="bg-gray-100 p-2 rounded mt-1 text-sm text-gray-800">
//                             {executionResult.stdout}
//                           </pre>
//                         </p>
//                       )}
//                       {executionResult.stderr && (
//                         <p className="text-sm mt-2">
//                           <strong>Error (stderr):</strong>
//                           <pre className="bg-red-50 p-2 rounded mt-1 text-sm text-red-600">
//                             {executionResult.stderr}
//                           </pre>
//                         </p>
//                       )}
//                       <p className="text-sm mt-2">
//                         <strong>Exit Code:</strong> {executionResult.exit_code ?? 'N/A'}
//                       </p>
//                       <p className="text-sm mt-2">
//                         <strong>Time:</strong> {executionResult.time ? `${executionResult.time} s` : 'N/A'}
//                       </p>
//                       <p className="text-sm mt-2">
//                         <strong>Memory:</strong> {executionResult.memory ? `${executionResult.memory} KB` : 'N/A'}
//                       </p>
//                     </div>
//                   )}
//                 </div>
//               </>
//             ) : (
//               <div className="flex items-center justify-center h-[70vh] bg-gray-100 rounded-2xl">
//                 <p className="text-gray-500 text-base">Select a file to edit</p>
//               </div>
//             )}
//           </div>

//           {/* Right Sidebar - Chat */}
//           <div className="lg:w-1/4 bg-white shadow-sm rounded-2xl p-6">
//             <h2 className="text-base font-semibold text-gray-900 mb-4">Collaboration Chat</h2>
//             <ChatBox projectId={projectId} username={userId} />
//           </div>
//         </div>
//       </div>

//       {/* Modals */}
//       {isCreateFileModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out">
//           <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
//             <h3 className="text-base font-semibold text-gray-900 mb-4">Create a New File</h3>
//             <input
//               type="text"
//               placeholder="File Name (e.g., script.js)"
//               value={newFileName}
//               onChange={(e) => setNewFileName(e.target.value)}
//               className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 mb-6"
//             />
//             <div className="flex justify-end space-x-3">
//               <button
//                 onClick={() => setIsCreateFileModalOpen(false)}
//                 className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg transition-all duration-200"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleCreateFile}
//                 className="bg-gradient-to-r from-blue-400 to-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-blue-300"
//               >
//                 Create
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {isCreateFolderModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out">
//           <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
//             <h3 className="text-base font-semibold text-gray-900 mb-4">Create a New Folder</h3>
//             <input
//               type="text"
//               placeholder="Folder Name"
//               value={newFolderName}
//               onChange={(e) => setNewFolderName(e.target.value)}
//               className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all duration-200 mb-6"
//             />
//             <div className="flex justify-end space-x-3">
//               <button
//                 onClick={() => setIsCreateFolderModalOpen(false)}
//                 className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg transition-all duration-200"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleCreateFolder}
//                 className="bg-gradient-to-r from-green-400 to-green-500 text-white px-4 py-2 rounded-lg font-medium hover:from-green-500 hover:to-green-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-green-300"
//               >
//                 Create
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {isCommitModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out">
//           <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
//             <h3 className="text-base font-semibold text-gray-900 mb-4">Commit Changes to GitHub</h3>
//             <input
//               type="text"
//               placeholder="Commit Message (e.g., Update mergeSort.js)"
//               value={commitMessage}
//               onChange={(e) => setCommitMessage(e.target.value)}
//               className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-200 mb-6"
//             />
//             <div className="flex justify-end space-x-3">
//               <button
//                 onClick={() => setIsCommitModalOpen(false)}
//                 className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg transition-all duration-200"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleCommit}
//                 className="bg-gradient-to-r from-purple-400 to-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 transition-all duration-200 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-purple-300"
//               >
//                 Commit
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ProjectWorkspace;



// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import MonacoEditor from '@monaco-editor/react';
// import ChatBox from '../components/ChatBox';
// import SockJS from 'sockjs-client';
// import { Client } from '@stomp/stompjs';
// import debounce from 'lodash/debounce';
// import { toast } from 'react-toastify';
// import useExecuteCode from './ExecutionProject';
// import Navbar from '../components/Navbar'; // Adjust path as needed
// import { FolderIcon, DocumentIcon, PlayIcon, PlusIcon } from '@heroicons/react/24/outline';

// const ProjectWorkspace = () => {
//   const { projectId } = useParams();
//   const navigate = useNavigate();
//   const location = useLocation();
//   const [project, setProject] = useState(null);
//   const [files, setFiles] = useState([]);
//   const [currentFile, setCurrentFile] = useState(null);
//   const [fileContent, setFileContent] = useState('');
//   const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false);
//   const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
//   const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
//   const [newFileName, setNewFileName] = useState('');
//   const [newFolderName, setNewFolderName] = useState('');
//   const [commitMessage, setCommitMessage] = useState('');
//   const [selectedFolder, setSelectedFolder] = useState(null);
//   const [expandedFolders, setExpandedFolders] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [modifiedFiles, setModifiedFiles] = useState({});
//   const {
//     executeCode,
//     executionResult,
//     executionLoading,
//     executionError,
//     setExecutionResult,
//     setExecutionError,
//   } = useExecuteCode();

//   const stompClient = useRef(null);
//   const editorRef = useRef(null);
//   const subscriptionRef = useRef(null);
//   const userId = localStorage.getItem('githubLogin');

//   const getFileTypeInfo = (filePath) => {
//     if (!filePath) return { language: 'plaintext', judge0Language: null };
//     const extension = filePath.split('.').pop().toLowerCase();
//     const languageMap = {
//       js: { language: 'javascript', judge0Language: 'javascript' },
//       py: { language: 'python', judge0Language: 'python3' },
//       html: { language: 'html', judge0Language: null },
//       css: { language: 'css', judge0Language: null },
//       json: { language: 'json', judge0Language: null },
//       md: { language: 'markdown', judge0Language: null },
//       ts: { language: 'typescript', judge0Language: 'typescript' },
//       java: { language: 'java', judge0Language: 'java' },
//       c: { language: 'c', judge0Language: 'c' },
//       cpp: { language: 'cpp', judge0Language: 'cpp' },
//     };
//     return languageMap[extension] || { language: 'plaintext', judge0Language: null };
//   };

//   const sendEditorChange = useCallback(
//     debounce((value) => {
//       if (stompClient.current?.connected && currentFile) {
//         const message = {
//           projectId,
//           senderId: userId,
//           type: 'edit',
//           content: value,
//           timestamp: Date.now(),
//         };
//         try {
//           stompClient.current.publish({
//             destination: `/app/collaborate/${projectId}/${currentFile}`,
//             body: JSON.stringify(message),
//           });
//         } catch (e) {
//           console.error('Failed to send edit:', e);
//         }
//       }
//     }, 300),
//     [projectId, currentFile, userId]
//   );

//   useEffect(() => {
//     const socket = new SockJS('http://localhost:8080/ws');
//     stompClient.current = new Client({
//       webSocketFactory: () => socket,
//       reconnectDelay: 5000,
//       onConnect: () => {
//         console.log('WebSocket connected');
//         stompClient.current.publish({
//           destination: `/app/join/${projectId}/`,
//           body: JSON.stringify(userId),
//         });
//         stompClient.current.subscribe(`/topic/session/${projectId}`, (message) => {
//           console.log('Session update:', message.body);
//         });
//         if (currentFile) {
//           subscribeToFileUpdates();
//           requestInitialCode();
//         }
//       },
//       onStompError: (frame) => {
//         console.error('STOMP error:', frame);
//       },
//       onWebSocketClose: () => {
//         console.warn('WebSocket closed');
//       },
//     });

//     stompClient.current.activate();

//     return () => {
//       if (stompClient.current) {
//         if (stompClient.current.connected) {
//           stompClient.current.publish({
//             destination: `/app/leave/${projectId}/`,
//             body: JSON.stringify(userId),
//           });
//         }
//         stompClient.current.deactivate();
//         console.log('WebSocket deactivated');
//       }
//     };
//   }, [projectId, userId]);

//   useEffect(() => {
//     if (stompClient.current?.connected && projectId && currentFile) {
//       if (subscriptionRef.current) {
//         subscriptionRef.current.unsubscribe();
//       }
//       subscribeToFileUpdates();
//       requestInitialCode();
//     }

//     return () => {
//       if (subscriptionRef.current) {
//         subscriptionRef.current.unsubscribe();
//       }
//     };
//   }, [currentFile, projectId]);

//   const subscribeToFileUpdates = () => {
//     if (!stompClient.current?.connected) return;
//     subscriptionRef.current = stompClient.current.subscribe(
//       `/topic/collaboration/${projectId}/${currentFile}`,
//       (message) => {
//         try {
//           const collaborationMessage = JSON.parse(message.body);
//           const newContent = collaborationMessage.content || '';
//           setFileContent(newContent);
//           if (editorRef.current) {
//             const position = editorRef.current.getPosition();
//             const currentValue = editorRef.current.getValue();
//             if (currentValue !== newContent) {
//               editorRef.current.setValue(newContent);
//               editorRef.current.setPosition(position);
//             }
//           }
//           const updatedFiles = updateFileByPath(files, currentFile, (file) => ({
//             ...file,
//             content: newContent,
//           }));
//           setFiles(updatedFiles);
//         } catch (e) {
//           console.error('Error parsing collaboration message:', e);
//         }
//       }
//     );
//   };

//   const requestInitialCode = () => {
//     if (stompClient.current?.connected && currentFile) {
//       stompClient.current.publish({
//         destination: `/app/requestCode/${projectId}/${currentFile}`,
//         body: JSON.stringify({ userId }),
//       });
//     }
//   };

//   useEffect(() => {
//     const fetchProjectData = async () => {
//       setLoading(true);
//       setError(null);
//       const queryParams = new URLSearchParams(location.search);
//       const owner = queryParams.get('owner');
//       const accessToken = localStorage.getItem('token');
//       const repo = projectId;
//       const branch = 'main';

//       if (!owner || !accessToken) {
//         toast.error('Authentication missing. Please log in again.');
//         navigate('/');
//         return;
//       }

//       try {
//         const params = new URLSearchParams({ owner, repo, branch });
//         const response = await fetch(`/api/github/files?${params.toString()}`, {
//           headers: {
//             Authorization: `Bearer ${accessToken}`,
//           },
//         });

//         if (!response.ok) {
//           throw new Error(`API Error: ${response.statusText}`);
//         }

//         const fileData = await response.json();
//         console.log('Fetched files:', fileData);

//         const fileTree = buildFileTree(fileData);
//         const projectData = {
//           id: projectId,
//           name: repo,
//           description: fileData['README.md']?.split('\n')[1] || `Description for ${repo}`,
//           files: fileTree,
//           owner,
//           repo,
//         };

//         setProject(projectData);
//         setFiles(projectData.files || []);

//         const initialExpanded = {};
//         const collectFolders = (fileList) => {
//           fileList.forEach((file) => {
//             if (file.type === 'folder') {
//               initialExpanded[file.path] = true;
//               if (file.children) collectFolders(file.children);
//             }
//           });
//         };
//         collectFolders(projectData.files);
//         setExpandedFolders(initialExpanded);

//         const firstFile =
//           findFileByPath(projectData.files, 'index.js') ||
//           projectData.files.find((f) => f.type === 'file');

//         if (firstFile) {
//           setCurrentFile(firstFile.path);
//         }
//       } catch (err) {
//         setError(err.message);
//         toast.error(`Failed to load project: ${err.message}`);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchProjectData();
//   }, [projectId, navigate, location.search]);

//   const handleEditorChange = (value) => {
//     setFileContent(value);
//     sendEditorChange(value);
//     setModifiedFiles((prev) => ({
//       ...prev,
//       [currentFile]: value,
//     }));
//     const updatedFiles = updateFileByPath(files, currentFile, (file) => ({
//       ...file,
//       content: value,
//     }));
//     setFiles(updatedFiles);
//   };

//   const handleCommit = async () => {
//     if (!commitMessage) {
//       toast.error('Please enter a commit message');
//       return;
//     }
//     const queryParams = new URLSearchParams(location.search);
//     const owner = queryParams.get('owner');
//     const accessToken = localStorage.getItem('token');
//     const repo = projectId;
//     const branch = 'main';

//     const filesWithPaths = {};
//     const allFiles = collectAllFiles(files);
//     allFiles.forEach((file) => {
//       if (modifiedFiles[file.path] && modifiedFiles[file.path] !== file.originalContent) {
//         filesWithPaths[file.path] = modifiedFiles[file.path];
//       }
//     });

//     if (Object.keys(filesWithPaths).length === 0) {
//       toast.error('No changes to commit');
//       return;
//     }

//     try {
//       const commitRequest = {
//         owner,
//         repo,
//         filesWithPaths,
//         commitMessage,
//         branch,
//       };

//       const response = await fetch('http://localhost:8080/api/github/commit', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${accessToken}`,
//         },
//         body: JSON.stringify(commitRequest),
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to commit: ${response.statusText}`);
//       }

//       toast.success('✅ Commit successful.');
//       setCommitMessage('');
//       setIsCommitModalOpen(false);
//       setModifiedFiles({});
//     } catch (err) {
//       toast.error(`Error committing: ${err.message}`);
//     }
//   };

//   const leaveWorkspace = () => {
//     if (stompClient.current?.connected) {
//       stompClient.current.publish({
//         destination: `/app/leave/${projectId}/`,
//         body: JSON.stringify(userId),
//       });
//     }
//     navigate('/projects');
//   };

//   const buildFileTree = (fileData) => {
//     const tree = [];
//     const folders = {};

//     Object.entries(fileData).forEach(([path, content]) => {
//       const parts = path.split('/');
//       let currentLevel = tree;
//       let currentPath = '';

//       parts.forEach((part, index) => {
//         currentPath = currentPath ? `${currentPath}/${part}` : part;

//         if (index === parts.length - 1) {
//           currentLevel.push({
//             name: part,
//             type: 'file',
//             path: currentPath,
//             content: content || '',
//             originalContent: content || '',
//           });
//         } else {
//           if (!folders[currentPath]) {
//             const folder = {
//               name: part,
//               type: 'folder',
//               path: currentPath,
//               children: [],
//             };
//             folders[currentPath] = folder;
//             currentLevel.push(folder);
//             currentLevel = folder.children;
//           } else {
//             currentLevel = folders[currentPath].children;
//           }
//         }
//       });
//     });

//     const sortTree = (items) =>
//       items.sort((a, b) => {
//         if (a.type === 'folder' && b.type === 'file') return -1;
//         if (a.type === 'file' && b.type === 'folder') return 1;
//         return a.name.localeCompare(b.name);
//       });

//     const sortedTree = sortTree(tree);
//     sortedTree.forEach((item) => {
//       if (item.type === 'folder') {
//         item.children = sortTree(item.children);
//       }
//     });

//     return sortedTree;
//   };

//   const collectAllFiles = (fileList) => {
//     const allFiles = [];
//     fileList.forEach((item) => {
//       if (item.type === 'file') allFiles.push(item);
//       else if (item.type === 'folder' && item.children) {
//         allFiles.push(...collectAllFiles(item.children));
//       }
//     });
//     return allFiles;
//   };

//   const handleEditorDidMount = (editor, monaco) => {
//     editorRef.current = editor;
//     if (currentFile) {
//       const { language } = getFileTypeInfo(currentFile);
//       monaco.editor.setModelLanguage(editor.getModel(), language);
//       monaco.languages.registerCompletionItemProvider(language, {
//         triggerCharacters: ['.'],
//         provideCompletionItems: (model, position) => {
//           const suggestions =
//             language === 'javascript'
//               ? [
//                   {
//                     label: 'consoleLog',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'console.log(${1:msg});',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Log to console',
//                   },
//                   {
//                     label: 'function',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'function ${1:name}(${2:params}) {\n  ${3}\n}',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Function declaration',
//                   },
//                   {
//                     label: 'arrowFunc',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'const ${1:name} = (${2:params}) => {\n  ${3}\n};',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Arrow function',
//                   },
//                 ]
//               : language === 'python'
//               ? [
//                   {
//                     label: 'print',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'print(${1:msg})',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Print to console',
//                   },
//                   {
//                     label: 'def',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'def ${1:name}(${2:params}):\n    ${3:pass}',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Function definition',
//                   },
//                   {
//                     label: 'class',
//                     kind: monaco.languages.CompletionItemKind.Snippet,
//                     insertText: 'class ${1:Name}:\n    def __init__(self):\n        ${2:pass}',
//                     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//                     documentation: 'Class definition',
//                   },
//                 ]
//               : [];
//           return { suggestions };
//         },
//       });
//     }
//   };

//   const findFileByPath = (fileList, filePath) => {
//     for (const item of fileList) {
//       if (item.type === 'file' && item.path === filePath) return item;
//       if (item.type === 'folder' && item.children) {
//         const found = findFileByPath(item.children, filePath);
//         if (found) return found;
//       }
//     }
//     return null;
//   };

//   const updateFileByPath = (fileList, targetPath, updateFn) => {
//     return fileList.map((item) => {
//       if (item.path === targetPath) return updateFn(item);
//       if (item.type === 'folder' && item.children) {
//         return {
//           ...item,
//           children: updateFileByPath(item.children, targetPath, updateFn),
//         };
//       }
//       return item;
//     });
//   };

//   const handleFileClick = (filePath) => {
//     setCurrentFile(filePath);
//     const file = findFileByPath(files, filePath);
//     const content = modifiedFiles[filePath] || file?.content || '';
//     setFileContent(content);
//     if (editorRef.current) {
//       const { language } = getFileTypeInfo(filePath);
//       window.monaco.editor.setModelLanguage(editorRef.current.getModel(), language);
//       editorRef.current.setValue(content);
//     }
//     setExecutionResult(null);
//     setExecutionError(null);
//   };

//   const handleFolderClick = (folder) => {
//     setSelectedFolder(folder);
//     setNewFileName('');
//     setIsCreateFileModalOpen(true);
//   };

//   const toggleFolder = (folderPath) => {
//     setExpandedFolders((prev) => ({
//       ...prev,
//       [folderPath]: !prev[folderPath],
//     }));
//   };

//   const handleCreateFile = () => {
//     if (!newFileName) {
//       toast.error('Please enter a file name');
//       return;
//     }
//     let updatedFiles = [...files];
//     const newFileContent = '';
//     if (selectedFolder) {
//       const newFilePath = `${selectedFolder.path}/${newFileName}`;
//       const newFile = {
//         name: newFileName,
//         type: 'file',
//         path: newFilePath,
//         content: newFileContent,
//         originalContent: newFileContent,
//       };
//       updatedFiles = updateFileByPath(updatedFiles, selectedFolder.path, (folder) => ({
//         ...folder,
//         children: [...(folder.children || []), newFile],
//       }));
//     } else {
//       updatedFiles.push({
//         name: newFileName,
//         type: 'file',
//         path: newFileName,
//         content: newFileContent,
//         originalContent: newFileContent,
//       });
//     }

//     setFiles(updatedFiles);
//     if (selectedFolder) {
//       setExpandedFolders((prev) => ({
//         ...prev,
//         [selectedFolder.path]: true,
//       }));
//     }
//     setNewFileName('');
//     setIsCreateFileModalOpen(false);
//     toast.success(`File ${newFileName} created successfully`);
//   };

//   const handleCreateFolder = () => {
//     if (!newFolderName) {
//       toast.error('Please enter a folder name');
//       return;
//     }
//     const updatedFiles = [
//       ...files,
//       {
//         name: newFolderName,
//         type: 'folder',
//         path: newFolderName,
//         children: [],
//       },
//     ];
//     setFiles(updatedFiles);
//     setExpandedFolders((prev) => ({
//       ...prev,
//       [newFolderName]: true,
//     }));
//     setNewFolderName('');
//     setIsCreateFolderModalOpen(false);
//     toast.success(`Folder ${newFolderName} created successfully`);
//   };

//   const renderFileTree = (fileList) =>
//     fileList.map((file) =>
//       file.type === 'file' ? (
//         <li key={file.path} className="flex items-center pl-4 py-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200">
//           <DocumentIcon className="w-4 h-4 text-gray-600 mr-2" />
//           <span
//             className={`cursor-pointer flex-1 text-sm font-medium ${
//               currentFile === file.path
//                 ? 'bg-blue-100 text-blue-800 rounded-lg px-2 py-1'
//                 : 'text-gray-700 hover:text-blue-600'
//             }`}
//             onClick={() => handleFileClick(file.path)}
//           >
//             {file.name}
//           </span>
//           {getFileTypeInfo(file.path).judge0Language && (
//             <button
//               onClick={() => {
//                 const fileData = findFileByPath(files, file.path);
//                 executeCode(
//                   file.path,
//                   fileData.content,
//                   projectId,
//                   userId,
//                   getFileTypeInfo(file.path).judge0Language
//                 );
//               }}
//               disabled={executionLoading}
//               className={`text-orange-500 hover:text-orange-600 text-sm ml-2 p-1 rounded-full transition-all duration-200 ${
//                 executionLoading ? 'opacity-50 cursor-not-allowed' : ''
//               }`}
//               title="Execute file"
//             >
//               <PlayIcon className="w-4 h-4" />
//             </button>
//           )}
//         </li>
//       ) : (
//         <li key={file.path}>
//           <div className="flex items-center pl-4 py-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200">
//             <div
//               className="flex items-center font-semibold cursor-pointer text-gray-800 hover:text-gray-900 flex-1"
//               onClick={() => toggleFolder(file.path)}
//             >
//               <span className="mr-2 text-sm">
//                 {expandedFolders[file.path] ? '▼' : '▶'}
//               </span>
//               <FolderIcon className="w-4 h-4 text-gray-600 mr-2" />
//               <span className="text-sm font-medium">{file.name}</span>
//             </div>
//             <button
//               onClick={() => handleFolderClick(file)}
//               className="text-green-500 hover:text-green-600 text-sm p-1 rounded-full transition-all duration-200"
//               title="Add file to folder"
//             >
//               <PlusIcon className="w-4 h-4" />
//             </button>
//           </div>
//           {expandedFolders[file.path] && file.children && file.children.length > 0 && (
//             <ul className="pl-6">{renderFileTree(file.children)}</ul>
//           )}
//         </li>
//       )
//     );

//   return (
//     <div className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
//       <Navbar />
//       <div className="flex flex-col lg:flex-row container mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
//         {/* Left Sidebar - File Tree */}
//         <div className="lg:w-1/4 bg-white shadow-lg rounded-2xl p-6 transition-all duration-300 hover:shadow-xl">
//           <h3 className="text-xl font-bold text-gray-900 mb-6">Files</h3>
//           {loading ? (
//             <p className="text-gray-500 animate-pulse">Loading files...</p>
//           ) : error ? (
//             <p className="text-red-500">Error: {error}</p>
//           ) : files.length ? (
//             <ul className="space-y-1">{renderFileTree(files)}</ul>
//           ) : (
//             <p className="text-gray-500">No files found</p>
//           )}
//           <div className="mt-8 space-y-3">
//             <button
//               onClick={() => {
//                 setSelectedFolder(null);
//                 setIsCreateFileModalOpen(true);
//               }}
//               className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
//             >
//               Create File
//             </button>
//             <button
//               onClick={() => setIsCreateFolderModalOpen(true)}
//               className="w-full bg-green-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-300"
//             >
//               Create Folder
//             </button>
//             <button
//               onClick={() => setIsCommitModalOpen(true)}
//               className="w-full bg-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-300"
//             >
//               Commit Changes
//             </button>
//             <button
//               onClick={leaveWorkspace}
//               className="w-full bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-300"
//             >
//               Leave Workspace
//             </button>
//           </div>
//         </div>

//         {/* Center - Code Editor and Execution Results */}
//         <div className="lg:w-2/4 flex flex-col gap-6">
//           <div>
//             <h2 className="text-2xl font-bold text-gray-900 mb-2">{project?.name || 'Loading...'}</h2>
//             <p className="text-gray-600 mb-4">{project?.description || ''}</p>
//           </div>
//           {loading ? (
//             <div className="flex items-center justify-center h-[600px] bg-gray-200 rounded-2xl">
//               <p className="text-gray-500 text-lg animate-pulse">Loading editor...</p>
//             </div>
//           ) : error ? (
//             <div className="flex items-center justify-center h-[600px] bg-gray-200 rounded-2xl">
//               <p className="text-red-500 text-lg">Failed to load project: {error}</p>
//             </div>
//           ) : currentFile ? (
//             <>
//               <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
//                 <MonacoEditor
//                   height="400px"
//                   language={getFileTypeInfo(currentFile).language}
//                   value={fileContent}
//                   onChange={handleEditorChange}
//                   onMount={handleEditorDidMount}
//                   options={{
//                     theme: 'vs-dark',
//                     fontSize: 14,
//                     automaticLayout: true,
//                     minimap: { enabled: false },
//                     wordWrap: 'on',
//                     scrollBeyondLastLine: false,
//                     suggest: {
//                       snippetsPreventQuickSuggestions: false,
//                       suggestions: true,
//                     },
//                     quickSuggestions: {
//                       other: true,
//                       comments: true,
//                       strings: true,
//                     },
//                     padding: { top: 10, bottom: 10 },
//                   }}
//                 />
//               </div>
//               <div className="bg-white shadow-lg rounded-2xl p-6">
//                 <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Results</h3>
//                 {executionLoading && <p className="text-gray-500 animate-pulse">Executing...</p>}
//                 {executionError && <p className="text-red-500">{executionError}</p>}
//                 {executionResult && (
//                   <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
//                     <p className="text-sm">
//                       <strong>Status:</strong> {executionResult.status?.description}
//                     </p>
//                     {executionResult.stdout && (
//                       <p className="text-sm mt-2">
//                         <strong>Output (stdout):</strong>
//                         <pre className="bg-gray-100 p-2 rounded mt-1 text-sm">{executionResult.stdout}</pre>
//                       </p>
//                     )}
//                     {executionResult.stderr && (
//                       <p className="text-sm mt-2">
//                         <strong>Error (stderr):</strong>
//                         <pre className="bg-red-50 p-2 rounded mt-1 text-sm text-red-600">{executionResult.stderr}</pre>
//                       </p>
//                     )}
//                     <p className="text-sm mt-2">
//                       <strong>Exit Code:</strong> {executionResult.exit_code ?? 'N/A'}
//                     </p>
//                     <p className="text-sm mt-2">
//                       <strong>Time:</strong> {executionResult.time ? `${executionResult.time} s` : 'N/A'}
//                     </p>
//                     <p className="text-sm mt-2">
//                       <strong>Memory:</strong> {executionResult.memory ? `${executionResult.memory} KB` : 'N/A'}
//                     </p>
//                   </div>
//                 )}
//               </div>
//             </>
//           ) : (
//             <div className="flex items-center justify-center h-[600px] bg-gray-200 rounded-2xl">
//               <p className="text-gray-500 text-lg">Select a file to edit</p>
//             </div>
//           )}
//         </div>

//         {/* Right Sidebar - Chat */}
//         <div className="lg:w-1/4 bg-white shadow-lg rounded-2xl p-6">
//           <h3 className="text-xl font-bold text-gray-900 mb-6">Collaboration Chat</h3>
//           <ChatBox projectId={projectId} username={userId} />
//         </div>
//       </div>

//       {/* Modals */}
//       {isCreateFileModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
//           <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
//             <h3 className="text-lg font-semibold text-gray-900 mb-4">Create a New File</h3>
//             <input
//               type="text"
//               placeholder="File Name (e.g., script.js)"
//               value={newFileName}
//               onChange={(e) => setNewFileName(e.target.value)}
//               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 mb-6"
//             />
//             <div className="flex justify-end space-x-4">
//               <button
//                 onClick={() => setIsCreateFileModalOpen(false)}
//                 className="text-gray-600 hover:text-gray-800 font-medium px-4 py-2 rounded-lg transition-all duration-200"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleCreateFile}
//                 className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
//               >
//                 Create
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {isCreateFolderModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
//           <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
//             <h3 className="text-lg font-semibold text-gray-900 mb-4">Create a New Folder</h3>
//             <input
//               type="text"
//               placeholder="Folder Name"
//               value={newFolderName}
//               onChange={(e) => setNewFolderName(e.target.value)}
//               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 mb-6"
//             />
//             <div className="flex justify-end space-x-4">
//               <button
//                 onClick={() => setIsCreateFolderModalOpen(false)}
//                 className="text-gray-600 hover:text-gray-800 font-medium px-4 py-2 rounded-lg transition-all duration-200"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleCreateFolder}
//                 className="bg-green-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-300"
//               >
//                 Create
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {isCommitModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
//           <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
//             <h3 className="text-lg font-semibold text-gray-900 mb-4">Commit Changes to GitHub</h3>
//             <input
//               type="text"
//               placeholder="Commit Message (e.g., Update mergeSort.js)"
//               value={commitMessage}
//               onChange={(e) => setCommitMessage(e.target.value)}
//               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 mb-6"
//             />
//             <div className="flex justify-end space-x-4">
//               <button
//                 onClick={() => setIsCommitModalOpen(false)}
//                 className="text-gray-600 hover:text-gray-800 font-medium px-4 py-2 rounded-lg transition-all duration-200"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleCommit}
//                 className="bg-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-300"
//               >
//                 Commit
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ProjectWorkspace;




// import React, { useState, useEffect, useRef, useCallback } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import MonacoEditor from "@monaco-editor/react";
// import ChatBox from "../components/ChatBox";
// import SockJS from "sockjs-client";
// import { Client } from "@stomp/stompjs";
// import debounce from "lodash/debounce";
// import useExecuteCode from "./ExecutionProject";

// const ProjectWorkspace = () => {
//   const { projectId } = useParams();
//   const navigate = useNavigate();
//   const [project, setProject] = useState(null);
//   const [files, setFiles] = useState([]);
//   const [currentFile, setCurrentFile] = useState(null);
//   const [fileContent, setFileContent] = useState("");
//   const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false);
//   const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
//   const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
//   const [newFileName, setNewFileName] = useState("");
//   const [newFolderName, setNewFolderName] = useState("");
//   const [commitMessage, setCommitMessage] = useState("");
//   const [selectedFolder, setSelectedFolder] = useState(null);
//   const [expandedFolders, setExpandedFolders] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [modifiedFiles, setModifiedFiles] = useState({});
//   const {
//     executeCode,
//     executionResult,
//     executionLoading,
//     executionError,
//     setExecutionResult,
//     setExecutionError,
//   } = useExecuteCode();

//   const stompClient = useRef(null);
//   const editorRef = useRef(null);
//   const subscriptionRef = useRef(null);
//   const userId = localStorage.getItem("githubLogin");

//   // Determine language based on file extension
//   const getFileTypeInfo = (filePath) => {
//     if (!filePath) return { language: "plaintext", judge0Language: null };
//     const extension = filePath.split(".").pop().toLowerCase();
//     const languageMap = {
//       js: { language: "javascript", judge0Language: "javascript" },
//       py: { language: "python", judge0Language: "python3" },
//       html: { language: "html", judge0Language: null },
//       css: { language: "css", judge0Language: null },
//       json: { language: "json", judge0Language: null },
//       md: { language: "markdown", judge0Language: null },
//       ts: { language: "typescript", judge0Language: "typescript" },
//       java: { language: "java", judge0Language: "java" },
//       c: { language: "c", judge0Language: "c" },
//       cpp: { language: "cpp", judge0Language: "cpp" },
//     };
//     return languageMap[extension] || { language: "plaintext", judge0Language: null };
//   };

//   // Debounced function to send editor changes
//   const sendEditorChange = useCallback(
//     debounce((value) => {
//       if (stompClient.current?.connected && currentFile) {
//         const message = {
//           projectId,
//           senderId: userId,
//           type: "edit",
//           content: value,
//           timestamp: Date.now(),
//         };
//         try {
//           stompClient.current.publish({
//             destination: `/app/collaborate/${projectId}/${currentFile}`,
//             body: JSON.stringify(message),
//           });
//         } catch (e) {
//           console.error("Failed to send edit:", e);
//         }
//       }
//     }, 300),
//     [projectId, currentFile, userId]
//   );

//   // Initialize WebSocket connection and join workspace
//   useEffect(() => {
//     const socket = new SockJS("http://localhost:8080/ws");
//     stompClient.current = new Client({
//       webSocketFactory: () => socket,
//       reconnectDelay: 5000,
//       onConnect: () => {
//         console.log("WebSocket connected");

//         // Join the project workspace
//         stompClient.current.publish({
//           destination: `/app/join/${projectId}/`,
//           body: JSON.stringify(userId),
//         });

//         // Subscribe to session updates
//         stompClient.current.subscribe(`/topic/session/${projectId}`, (message) => {
//           console.log("Session update:", message.body);
//         });

//         if (currentFile) {
//           subscribeToFileUpdates();
//           requestInitialCode();
//         }
//       },
//       onStompError: (frame) => {
//         console.error("STOMP error:", frame);
//       },
//       onWebSocketClose: () => {
//         console.warn("WebSocket closed");
//       },
//     });

//     stompClient.current.activate();

//     return () => {
//       if (stompClient.current) {
//         // Send leave message before deactivating
//         if (stompClient.current.connected) {
//           stompClient.current.publish({
//             destination: `/app/leave/${projectId}/`,
//             body: JSON.stringify(userId),
//           });
//         }
//         stompClient.current.deactivate();
//         console.log("WebSocket deactivated");
//       }
//     };
//   }, [projectId, userId]);

//   // Manage subscriptions when currentFile changes
//   useEffect(() => {
//     if (stompClient.current?.connected && projectId && currentFile) {
//       if (subscriptionRef.current) {
//         subscriptionRef.current.unsubscribe();
//       }
//       subscribeToFileUpdates();
//       requestInitialCode();
//     }

//     return () => {
//       if (subscriptionRef.current) {
//         subscriptionRef.current.unsubscribe();
//       }
//     };
//   }, [currentFile, projectId]);

//   // const subscribeToFileUpdates = () => {
//   //   if (!stompClient.current?.connected) return;
//   //   subscriptionRef.current = stompClient.current.subscribe(
//   //     `/topic/collaboration/${projectId}/${currentFile}`,
//   //     (message) => {
//   //       try {
//   //         const collaborationMessage = JSON.parse(message.body);
//   //         if (collaborationMessage.senderId !== userId) {
//   //           const newContent = collaborationMessage.content || "";
//   //           setFileContent(newContent);
//   //           if (editorRef.current) {
//   //             const position = editorRef.current.getPosition();
//   //             const currentValue = editorRef.current.getValue();
//   //             if (currentValue !== newContent) {
//   //               editorRef.current.setValue(newContent);
//   //               editorRef.current.setPosition(position);
//   //             }
//   //           }
//   //         }
//   //       } catch (e) {
//   //         console.error("Error parsing collaboration message:", e);
//   //       }
//   //     }
//   //   );
//   // };

//   const subscribeToFileUpdates = () => {
//     if (!stompClient.current?.connected) return;
//     subscriptionRef.current = stompClient.current.subscribe(
//         `/topic/collaboration/${projectId}/${currentFile}`,
//         (message) => {
//             try {
//                 const collaborationMessage = JSON.parse(message.body);
//                 const newContent = collaborationMessage.content || "";
//                 setFileContent(newContent);
//                 if (editorRef.current) {
//                     const position = editorRef.current.getPosition();
//                     const currentValue = editorRef.current.getValue();
//                     if (currentValue !== newContent) {
//                         editorRef.current.setValue(newContent);
//                         editorRef.current.setPosition(position);
//                     }
//                 }
//                 // Update file tree
//                 const updatedFiles = updateFileByPath(files, currentFile, (file) => ({
//                     ...file,
//                     content: newContent,
//                 }));
//                 setFiles(updatedFiles);
//             } catch (e) {
//                 console.error("Error parsing collaboration message:", e);
//             }
//         }
//     );
// };

//   const requestInitialCode = () => {
//     if (stompClient.current?.connected && currentFile) {
//       stompClient.current.publish({
//         destination: `/app/requestCode/${projectId}/${currentFile}`,
//         body: JSON.stringify({ userId }),
//       });
//     }
//   };


//   useEffect(() => {
//     const fetchProjectData = async () => {
//         setLoading(true);
//         setError(null);
//         const queryParams = new URLSearchParams(location.search);
//         const owner = queryParams.get("owner");
//         const accessToken = localStorage.getItem("token");
//         const repo = projectId;
//         const branch = "main";

//         if (!owner || !accessToken) {
//             alert("Authentication missing. Please log in again.");
//             navigate("/");
//             return;
//         }

//         try {
//             const params = new URLSearchParams({ owner, repo, branch });
//             const response = await fetch(`/api/github/files?${params.toString()}`, {
//                 headers: {
//                     Authorization: `Bearer ${accessToken}`,
//                 },
//             });

//             if (!response.ok) {
//                 throw new Error(`API Error: ${response.statusText}`);
//             }

//             const fileData = await response.json();
//             console.log("Fetched files:", fileData);

//             const fileTree = buildFileTree(fileData);
//             const projectData = {
//                 id: projectId,
//                 name: repo,
//                 description: fileData["README.md"]?.split("\n")[1] || `Description for ${repo}`,
//                 files: fileTree,
//                 owner,
//                 repo,
//             };

//             setProject(projectData);
//             setFiles(projectData.files || []);

//             const initialExpanded = {};
//             const collectFolders = (fileList) => {
//                 fileList.forEach((file) => {
//                     if (file.type === "folder") {
//                         initialExpanded[file.path] = true;
//                         if (file.children) collectFolders(file.children);
//                     }
//                 });
//             };
//             collectFolders(projectData.files);
//             setExpandedFolders(initialExpanded);

//             const firstFile =
//                 findFileByPath(projectData.files, "index.js") ||
//                 projectData.files.find((f) => f.type === "file");

//             if (firstFile) {
//                 setCurrentFile(firstFile.path);
//             }
//         } catch (err) {
//             setError(err.message);
//         } finally {
//             setLoading(false);
//         }
//     };

//     fetchProjectData();
// }, [projectId, navigate]);

//   // Handle editor changes
//   const handleEditorChange = (value) => {
//     setFileContent(value);
//     sendEditorChange(value);
//     setModifiedFiles((prev) => ({
//       ...prev,
//       [currentFile]: value,
//     }));
//     const updatedFiles = updateFileByPath(files, currentFile, (file) => ({
//       ...file,
//       content: value,
//     }));
//     setFiles(updatedFiles);
//   };

//   // Commit changes to GitHub (unchanged)
//   const handleCommit = async () => {
//     if (!commitMessage) {
//       alert("Please enter a commit message");
//       return;
//     }
//     const queryParams = new URLSearchParams(location.search);
//     const owner = queryParams.get("owner");
//     const accessToken = localStorage.getItem("token");
//     const repo = projectId;
//     const branch = "main";

//     const filesWithPaths = {};
//     const allFiles = collectAllFiles(files);
//     allFiles.forEach((file) => {
//       if (modifiedFiles[file.path] && modifiedFiles[file.path] !== file.originalContent) {
//         filesWithPaths[file.path] = modifiedFiles[file.path];
//       }
//     });

//     if (Object.keys(filesWithPaths).length === 0) {
//       alert("No changes to commit");
//       return;
//     }

//     try {
//       const commitRequest = {
//         owner,
//         repo,
//         filesWithPaths,
//         commitMessage,
//         branch,
//       };

//       const response = await fetch("http://localhost:8080/api/github/commit", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${accessToken}`,
//         },
//         body: JSON.stringify(commitRequest),
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to commit: ${response.statusText}`);
//       }

//       alert("✅ Commit successful.");
//       setCommitMessage("");
//       setIsCommitModalOpen(false);
//       setModifiedFiles({});
//     } catch (err) {
//       alert(`Error committing: ${err.message}`);
//     }
//   };

//   // Leave workspace
//   const leaveWorkspace = () => {
//     if (stompClient.current?.connected) {
//       stompClient.current.publish({
//         destination: `/app/leave/${projectId}/`,
//         body: JSON.stringify(userId),
//       });
//     }
//     navigate("/projects");
//   };

//   // Other unchanged functions (buildFileTree, collectAllFiles, handleEditorDidMount, etc.)
//   const buildFileTree = (fileData) => {
//     const tree = [];
//     const folders = {};

//     Object.entries(fileData).forEach(([path, content]) => {
//       const parts = path.split("/");
//       let currentLevel = tree;
//       let currentPath = "";

//       parts.forEach((part, index) => {
//         currentPath = currentPath ? `${currentPath}/${part}` : part;

//         if (index === parts.length - 1) {
//           currentLevel.push({
//             name: part,
//             type: "file",
//             path: currentPath,
//             content: content || "",
//             originalContent: content || "",
//           });
//         } else {
//           if (!folders[currentPath]) {
//             const folder = {
//               name: part,
//               type: "folder",
//               path: currentPath,
//               children: [],
//             };
//             folders[currentPath] = folder;
//             currentLevel.push(folder);
//             currentLevel = folder.children;
//           } else {
//             currentLevel = folders[currentPath].children;
//           }
//         }
//       });
//     });

//     const sortTree = (items) =>
//       items.sort((a, b) => {
//         if (a.type === "folder" && b.type === "file") return -1;
//         if (a.type === "file" && b.type === "folder") return 1;
//         return a.name.localeCompare(b.name);
//       });

//     const sortedTree = sortTree(tree);
//     sortedTree.forEach((item) => {
//       if (item.type === "folder") {
//         item.children = sortTree(item.children);
//       }
//     });

//     return sortedTree;
//   };

//   const collectAllFiles = (fileList) => {
//     const allFiles = [];
//     fileList.forEach((item) => {
//       if (item.type === "file") allFiles.push(item);
//       else if (item.type === "folder" && item.children) {
//         allFiles.push(...collectAllFiles(item.children));
//       }
//     });
//     return allFiles;
//   };

//   const handleEditorDidMount = (editor, monaco) => {
//     editorRef.current = editor;
//     if (currentFile) {
//       const { language } = getFileTypeInfo(currentFile);
//       monaco.editor.setModelLanguage(editor.getModel(), language);
//       monaco.languages.registerCompletionItemProvider(language, {
//         triggerCharacters: ["."],
//         provideCompletionItems: (model, position) => {
//           const suggestions = language === "javascript" ? [
//             {
//               label: "consoleLog",
//               kind: monaco.languages.CompletionItemKind.Snippet,
//               insertText: "console.log(${1:msg});",
//               insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//               documentation: "Log to console",
//             },
//             {
//               label: "function",
//               kind: monaco.languages.CompletionItemKind.Snippet,
//               insertText: "function ${1:name}(${2:params}) {\n  ${3}\n}",
//               insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//               documentation: "Function declaration",
//             },
//             {
//               label: "arrowFunc",
//               kind: monaco.languages.CompletionItemKind.Snippet,
//               insertText: "const ${1:name} = (${2:params}) => {\n  ${3}\n};",
//               insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//               documentation: "Arrow function",
//             },
//           ] : language === "python" ? [
//             {
//               label: "print",
//               kind: monaco.languages.CompletionItemKind.Snippet,
//               insertText: "print(${1:msg})",
//               insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//               documentation: "Print to console",
//             },
//             {
//               label: "def",
//               kind: monaco.languages.CompletionItemKind.Snippet,
//               insertText: "def ${1:name}(${2:params}):\n    ${3:pass}",
//               insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//               documentation: "Function definition",
//             },
//             {
//               label: "class",
//               kind: monaco.languages.CompletionItemKind.Snippet,
//               insertText: "class ${1:Name}:\n    def __init__(self):\n        ${2:pass}",
//               insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
//               documentation: "Class definition",
//             },
//           ] : [];
//           return { suggestions };
//         },
//       });
//     }
//   };

//   const findFileByPath = (fileList, filePath) => {
//     for (const item of fileList) {
//       if (item.type === "file" && item.path === filePath) return item;
//       if (item.type === "folder" && item.children) {
//         const found = findFileByPath(item.children, filePath);
//         if (found) return found;
//       }
//     }
//     return null;
//   };

//   const updateFileByPath = (fileList, targetPath, updateFn) => {
//     return fileList.map((item) => {
//       if (item.path === targetPath) return updateFn(item);
//       if (item.type === "folder" && item.children) {
//         return {
//           ...item,
//           children: updateFileByPath(item.children, targetPath, updateFn),
//         };
//       }
//       return item;
//     });
//   };

//   // const handleFileClick = (filePath) => {
//   //   setCurrentFile(filePath);
//   //   const file = findFileByPath(files, filePath);
//   //   const content = modifiedFiles[filePath] || file?.content || "";
//   //   setFileContent(content);
//   //   if (editorRef.current) {
//   //     const { language } = getFileTypeInfo(filePath);
//   //     window.monaco.editor.setModelLanguage(editorRef.current.getModel(), language);
//   //     editorRef.current.setValue(content);
//   //   }
//   //   setExecutionResult(null);
//   //   setExecutionError(null);
//   // };

//   const handleFileClick = (filePath) => {
//     setCurrentFile(filePath);
//     setExecutionResult(null);
//     setExecutionError(null);
//   };

//   const handleFolderClick = (folder) => {
//     setSelectedFolder(folder);
//     setNewFileName("");
//     setIsCreateFileModalOpen(true);
//   };

//   const toggleFolder = (folderPath) => {
//     setExpandedFolders((prev) => ({
//       ...prev,
//       [folderPath]: !prev[folderPath],
//     }));
//   };

//   const handleCreateFile = () => {
//     if (!newFileName) {
//       alert("Please enter a file name");
//       return;
//     }
//     let updatedFiles = [...files];
//     const newFileContent = "";
//     if (selectedFolder) {
//       const newFilePath = `${selectedFolder.path}/${newFileName}`;
//       const newFile = {
//         name: newFileName,
//         type: "file",
//         path: newFilePath,
//         content: newFileContent,
//         originalContent: newFileContent,
//       };
//       updatedFiles = updateFileByPath(updatedFiles, selectedFolder.path, (folder) => ({
//         ...folder,
//         children: [...(folder.children || []), newFile],
//       }));
//     } else {
//       updatedFiles.push({
//         name: newFileName,
//         type: "file",
//         path: newFileName,
//         content: newFileContent,
//         originalContent: newFileContent,
//       });
//     }

//     setFiles(updatedFiles);
//     if (selectedFolder) {
//       setExpandedFolders((prev) => ({
//         ...prev,
//         [selectedFolder.path]: true,
//       }));
//     }
//     setNewFileName("");
//     setIsCreateFileModalOpen(false);
//   };

//   const handleCreateFolder = () => {
//     if (!newFolderName) {
//       alert("Please enter a folder name");
//       return;
//     }
//     const updatedFiles = [...files, {
//       name: newFolderName,
//       type: "folder",
//       path: newFolderName,
//       children: [],
//     }];
//     setFiles(updatedFiles);
//     setExpandedFolders((prev) => ({
//       ...prev,
//       [newFolderName]: true,
//     }));
//     setNewFolderName("");
//     setIsCreateFolderModalOpen(false);
//   };

//   const renderFileTree = (fileList) =>
//     fileList.map((file) =>
//       file.type === "file" ? (
//         <li key={file.path} className="flex items-center pl-2 py-1">
//           <span
//             className={`cursor-pointer flex-1 rounded ${currentFile === file.path ? 'bg-blue-100 text-blue-800' : 'text-blue-600 hover:text-blue-800'}`}
//             onClick={() => handleFileClick(file.path)}
//           >
//             📄 {file.name}
//           </span>
//           {getFileTypeInfo(file.path).judge0Language && (
//             <button
//               onClick={() => {
//                 const fileData = findFileByPath(files, file.path);
//                 executeCode(
//                   file.path,
//                   fileData.content,
//                   projectId,
//                   userId,
//                   getFileTypeInfo(file.path).judge0Language
//                 );
//               }}
//               disabled={executionLoading}
//               className={`text-orange-500 hover:text-orange-700 text-sm ml-2 ${executionLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
//               title="Execute file"
//             >
//               ▶
//             </button>
//           )}
//         </li>
//       ) : (
//         <li key={file.path}>
//           <div className="flex items-center pl-2 py-1">
//             <div
//               className="flex items-center font-semibold cursor-pointer text-gray-800 hover:text-gray-900 flex-1"
//               onClick={() => toggleFolder(file.path)}
//             >
//               <span className="mr-1">{expandedFolders[file.path] ? "▼" : "▶"}</span>
//               📁 {file.name}
//             </div>
//             <button
//               onClick={() => handleFolderClick(file)}
//               className="text-green-500 hover:text-green-700 text-sm ml-2"
//               title="Add file to folder"
//             >
//               +
//             </button>
//           </div>
//           {expandedFolders[file.path] && file.children && file.children.length > 0 && (
//             <ul className="pl-4">{renderFileTree(file.children)}</ul>
//           )}
//         </li>
//       )
//     );

//   return (
//     <div className="flex min-h-screen bg-gray-100">
//       {/* Left Sidebar - File Tree */}
//       <div className="w-1/4 bg-white p-4 shadow-md">
//         <h3 className="text-xl font-bold mb-4 text-gray-800">Files</h3>
//         {loading ? (
//           <p className="text-gray-500">Loading files...</p>
//         ) : error ? (
//           <p className="text-red-500">Error: {error}</p>
//         ) : files.length ? (
//           <ul className="space-y-1">{renderFileTree(files)}</ul>
//         ) : (
//           <p className="text-gray-500">No files found</p>
//         )}
//         <div className="mt-6 space-y-2">
//           <button
//             onClick={() => {
//               setSelectedFolder(null);
//               setIsCreateFileModalOpen(true);
//             }}
//             className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition"
//           >
//             Create File
//           </button>
//           <button
//             onClick={() => setIsCreateFolderModalOpen(true)}
//             className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 transition"
//           >
//             Create Folder
//           </button>
//           <button
//             onClick={() => setIsCommitModalOpen(true)}
//             className="w-full bg-purple-500 text-white p-2 rounded hover:bg-purple-600 transition"
//           >
//             Commit Changes
//           </button>
//           <button
//             onClick={leaveWorkspace}
//             className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600 transition"
//           >
//             Leave Workspace
//           </button>
//         </div>
//       </div>

//       {/* Center - Code Editor and Execution Results */}
//       <div className="w-2/4 p-6">
//         <h2 className="text-2xl font-semibold mb-2 text-gray-800">{project?.name || "Loading..."}</h2>
//         <p className="text-gray-600 mb-4">{project?.description || ""}</p>
//         {loading ? (
//           <div className="flex items-center justify-center h-[600px] bg-gray-200 rounded">
//             <p className="text-gray-500 text-lg">Loading editor...</p>
//           </div>
//         ) : error ? (
//           <div className="flex items-center justify-center h-[600px] bg-gray-200 rounded">
//             <p className="text-red-500 text-lg">Failed to load project: {error}</p>
//           </div>
//         ) : currentFile ? (
//           <>
//             <div className="mb-4">
//               <MonacoEditor
//                 height="400px"
//                 language={getFileTypeInfo(currentFile).language}
//                 value={fileContent}
//                 onChange={handleEditorChange}
//                 onMount={handleEditorDidMount}
//                 options={{
//                   theme: "vs-dark",
//                   fontSize: 14,
//                   automaticLayout: true,
//                   minimap: { enabled: false },
//                   wordWrap: "on",
//                   scrollBeyondLastLine: false,
//                   suggest: {
//                     snippetsPreventQuickSuggestions: false,
//                     suggestions: true,
//                   },
//                   quickSuggestions: {
//                     other: true,
//                     comments: true,
//                     strings: true,
//                   },
//                   padding: { top: 10, bottom: 10 },
//                 }}
//               />
//             </div>
//             <div className="bg-gray-200 p-4 rounded">
//               <h3 className="text-lg font-semibold mb-2 text-gray-800">Execution Results</h3>
//               {executionLoading && <p className="text-gray-500">Executing...</p>}
//               {executionError && <p className="text-red-500">{executionError}</p>}
//               {executionResult && (
//                 <div className="p-4 bg-white rounded shadow">
//                   <p><strong>Status:</strong> {executionResult.status?.description}</p>
//                   {executionResult.stdout && (
//                     <p><strong>Output (stdout):</strong> <pre>{executionResult.stdout}</pre></p>
//                   )}
//                   {executionResult.stderr && (
//                     <p><strong>Error (stderr):</strong> <pre>{executionResult.stderr}</pre></p>
//                   )}
//                   <p><strong>Exit Code:</strong> {executionResult.exit_code ?? "N/A"}</p>
//                   <p><strong>Time:</strong> {executionResult.time ? `${executionResult.time} s` : "N/A"}</p>
//                   <p><strong>Memory:</strong> {executionResult.memory ? `${executionResult.memory} KB` : "N/A"}</p>
//                 </div>
//               )}
//             </div>
//           </>
//         ) : (
//           <div className="flex items-center justify-center h-[600px] bg-gray-200 rounded">
//             <p className="text-gray-500 text-lg">Select a file to edit</p>
//           </div>
//         )}
//       </div>

//       {/* Right Sidebar - Chat */}
//       <div className="w-1/4 bg-gray-800 text-white p-4 shadow-md">
//         <h3 className="text-xl font-bold mb-4">Chat</h3>
//         <ChatBox projectId={projectId} username={userId} />
//       </div>

//       {/* Modals (unchanged) */}
//       {isCreateFileModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
//           <div className="bg-white p-6 rounded-lg shadow-xl w-1/3">
//             <h3 className="text-lg font-semibold mb-4">Create a New File</h3>
//             <input
//               type="text"
//               placeholder="File Name (e.g., script.js)"
//               value={newFileName}
//               onChange={(e) => setNewFileName(e.target.value)}
//               className="border p-2 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
//             />
//             <div className="flex justify-end space-x-4">
//               <button
//                 onClick={() => setIsCreateFileModalOpen(false)}
//                 className="text-gray-500 hover:text-gray-700"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleCreateFile}
//                 className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
//               >
//                 Create
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {isCreateFolderModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
//           <div className="bg-white p-6 rounded-lg shadow-xl w-1/3">
//             <h3 className="text-lg font-semibold mb-4">Create a New Folder</h3>
//             <input
//               type="text"
//               placeholder="Folder Name"
//               value={newFolderName}
//               onChange={(e) => setNewFolderName(e.target.value)}
//               className="border p-2 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
//             />
//             <div className="flex justify-end space-x-4">
//               <button
//                 onClick={() => setIsCreateFolderModalOpen(false)}
//                 className="text-gray-500 hover:text-gray-700"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleCreateFolder}
//                 className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
//               >
//                 Create
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {isCommitModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
//           <div className="bg-white p-6 rounded-lg shadow-xl w-1/3">
//             <h3 className="text-lg font-semibold mb-4">Commit Changes to GitHub</h3>
//             <input
//               type="text"
//               placeholder="Commit Message (e.g., Update mergeSort.js)"
//               value={commitMessage}
//               onChange={(e) => setCommitMessage(e.target.value)}
//               className="border p-2 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
//             />
//             <div className="flex justify-end space-x-4">
//               <button
//                 onClick={() => setIsCommitModalOpen(false)}
//                 className="text-gray-500 hover:text-gray-700"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleCommit}
//                 className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition"
//               >
//                 Commit
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ProjectWorkspace;