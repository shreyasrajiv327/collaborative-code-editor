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
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [executionInput, setExecutionInput] = useState('');

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

  // [Existing getFileTypeInfo, sendEditorChange, WebSocket useEffect, subscribeToFileUpdates, requestInitialCode, fetchProjectData, handleEditorChange functions remain unchanged]

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

      // Update originalContent and clear modifiedFiles
      const updatedFiles = files.map((file) => {
        if (file.type === 'file' && filesWithPaths[file.path]) {
          return { ...file, originalContent: filesWithPaths[file.path] };
        } else if (file.type === 'folder' && file.children) {
          return {
            ...file,
            children: file.children.map((child) =>
              child.type === 'file' && filesWithPaths[child.path]
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
      setCommitMessage('');
      setIsCommitModalOpen(false);

      if (isLeaveModalOpen) {
        setIsLeaveModalOpen(false);
        if (stompClient.current?.connected) {
          stompClient.current.publish({
            destination: `/app/leave/${projectId}/`,
            body: JSON.stringify(userId),
          });
        }
        navigate('/projects');
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
      navigate('/projects');
    }
  };

  // [Existing buildFileTree, collectAllFiles, handleEditorDidMount, findFileByPath, updateFileByPath, handleFileClick, handleFolderClick, toggleFolder, toggleAllFolders, handleCreateFile, handleCreateFolder, hasUncommittedChanges functions remain unchanged]

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
      navigate('/projects');
    }
  };

  // [Existing useEffect for beforeunload remains unchanged]

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
            {modifiedFiles[file.path] && modifiedFiles[file.path] !== file.originalContent && (
              <span className="text-red-500 ml-1">*</span>
            )}
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
                  getFileTypeInfo(file.path).judge0Language,
                  executionInput
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
    </div>
  );
};

export default ProjectWorkspace;