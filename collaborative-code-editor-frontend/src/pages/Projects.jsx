import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Projects = () => {
  const [ownedProjects, setOwnedProjects] = useState([]);
  const [collabProjects, setCollabProjects] = useState([]);
  const [isAddCollaboratorModalOpen, setIsAddCollaboratorModalOpen] = useState(false);
  const [isRemoveCollaboratorModalOpen, setIsRemoveCollaboratorModalOpen] = useState(false);
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [collaboratorUsername, setCollaboratorUsername] = useState('');
  const [removeCollaboratorUsername, setRemoveCollaboratorUsername] = useState('');
  const [addCollaboratorError, setAddCollaboratorError] = useState(null);
  const [removeCollaboratorError, setRemoveCollaboratorError] = useState(null);
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [isRemovingCollaborator, setIsRemovingCollaborator] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = localStorage.getItem('token');
    if (!accessToken) {
      alert('Access token missing. Please log in again.');
      return;
    }

    const fetchProjects = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        };

        const [ownedRes, collabRes] = await Promise.all([
          fetch('/api/projects/owned', { method: 'GET', headers }),
          fetch('/api/projects/collaborating', { method: 'GET', headers }),
        ]);

        if (!ownedRes.ok || !collabRes.ok) {
          throw new Error(`Failed to fetch projects: Owned=${ownedRes.status}, Collab=${collabRes.status}`);
        }

        const ownedData = await ownedRes.json();
        const collabData = await collabRes.json();
        console.log('ownedData:', ownedData);
        console.log('collabData:', collabData);

        setOwnedProjects(Array.isArray(ownedData) ? ownedData : []);
        setCollabProjects(Array.isArray(collabData) ? collabData : []);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setOwnedProjects([]);
        setCollabProjects([]);
      }
    };

    fetchProjects();
  }, []);

  const handleProjectClick = (e, projectName, owner) => {
    if (e.target.tagName.toLowerCase() === 'button') return;
    navigate(`/project/${projectName}?owner=${encodeURIComponent(owner)}`);
  };

  const handleAddCollaborator = (projectName) => {
    setSelectedProjectName(projectName);
    setCollaboratorUsername('');
    setAddCollaboratorError(null);
    setIsAddCollaboratorModalOpen(true);
  };

  const handleAddCollaboratorSubmit = async () => {
    const accessToken = localStorage.getItem('token');
    if (!accessToken) {
      alert('Access token missing. Please log in again.');
      setIsAddCollaboratorModalOpen(false);
      return;
    }

    if (!collaboratorUsername.trim()) {
      setAddCollaboratorError('Please enter a GitHub username.');
      return;
    }

    if (!collaboratorUsername.match(/^[a-zA-Z0-9-]{1,39}$/)) {
      setAddCollaboratorError('Invalid GitHub username. Use 1-39 alphanumeric characters or hyphens.');
      return;
    }

    setIsAddingCollaborator(true);
    try {
      const response = await fetch('http://localhost:8080/api/github/add-collaborator', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          repoName: selectedProjectName,
          collaboratorUsername,
        }),
      });

      const message = await response.text();
      if (!response.ok) {
        throw new Error(message);
      }

      alert(message);
      setIsAddCollaboratorModalOpen(false);
      setCollaboratorUsername('');
      setAddCollaboratorError(null);

      // Refetch projects
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [ownedRes, collabRes] = await Promise.all([
        fetch('/api/projects/owned', { method: 'GET', headers }),
        fetch('/api/projects/collaborating', { method: 'GET', headers }),
      ]);
      if (ownedRes.ok && collabRes.ok) {
        setOwnedProjects(Array.isArray(await ownedRes.json()) ? await ownedRes.json() : []);
        setCollabProjects(Array.isArray(await collabRes.json()) ? await collabRes.json() : []);
      }
    } catch (error) {
      console.error('Error adding collaborator:', error);
      setAddCollaboratorError(`Failed to add collaborator: ${error.message}`);
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  const handleRemoveCollaborator = (projectName) => {
    setSelectedProjectName(projectName);
    setRemoveCollaboratorUsername('');
    setRemoveCollaboratorError(null);
    setIsRemoveCollaboratorModalOpen(true);
  };

  const handleRemoveCollaboratorSubmit = async () => {
    const accessToken = localStorage.getItem('token');
    if (!accessToken) {
      alert('Access token missing. Please log in again.');
      setIsRemoveCollaboratorModalOpen(false);
      return;
    }

    if (!removeCollaboratorUsername.trim()) {
      setRemoveCollaboratorError('Please enter a GitHub username.');
      return;
    }

    if (!removeCollaboratorUsername.match(/^[a-zA-Z0-9-]{1,39}$/)) {
      setRemoveCollaboratorError('Invalid GitHub username. Use 1-39 alphanumeric characters or hyphens.');
      return;
    }

    setIsRemovingCollaborator(true);
    try {
      const response = await fetch('http://localhost:8080/api/github/remove-collaborator', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          repoName: selectedProjectName,
          collaboratorUsername: removeCollaboratorUsername,
        }),
      });

      const message = await response.text();
      if (!response.ok) {
        throw new Error(message);
      }

      alert(message);
      setIsRemoveCollaboratorModalOpen(false);
      setRemoveCollaboratorUsername('');
      setRemoveCollaboratorError(null);

      // Refetch projects
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [ownedRes, collabRes] = await Promise.all([
        fetch('/api/projects/owned', { method: 'GET', headers }),
        fetch('/api/projects/collaborating', { method: 'GET', headers }),
      ]);
      if (ownedRes.ok && collabRes.ok) {
        setOwnedProjects(Array.isArray(await ownedRes.json()) ? await ownedRes.json() : []);
        setCollabProjects(Array.isArray(await collabRes.json()) ? await collabRes.json() : []);
      }
    } catch (error) {
      console.error('Error removing collaborator:', error);
      setRemoveCollaboratorError(`Failed to remove collaborator: ${error.message}`);
    } finally {
      setIsRemovingCollaborator(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-inter text-gray-900">
      <div className="container mx-auto px-6 py-12 max-w-5xl">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-10"> 
          Your Projects
        </h1>

        {/* Owned Projects */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-6">Owned Projects</h2>
          {ownedProjects.length === 0 ? (
            <div className="p-6 bg-notion-offwhite shadow-sm rounded-lg text-center">
              <p className="text-gray-600 mb-4">You don’t own any projects yet.</p>
              <button
                onClick={() => navigate('/create-project')}
                className="bg-gray-900 text-white px-4 py-2 rounded-md font-medium hover:bg-gray-700 transition"
              >
                Create a Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {ownedProjects.map((proj) => (
                <div
                  key={proj._id}
                  onClick={(e) => handleProjectClick(e, proj.name, proj.owner)}
                  className="cursor-pointer bg-notion-offwhite shadow-sm rounded-lg p-6 hover:shadow-md transition"
                >
                  <div className="hover:bg-gray-100 rounded-md transition">
                    <h3 className="text-lg font-semibold mb-2">{proj.name}</h3>
                    <p className="text-gray-600 mb-4">
                      {proj.description || 'No description'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAddCollaborator(proj.name)}
                      className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                    >
                      Add Collaborator
                    </button>
                    <button
                      onClick={() => handleRemoveCollaborator(proj.name)}
                      className="border border-gray-900 text-gray-900 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition"
                    >
                      Remove Collaborator
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collaborating Projects */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-6">Collaborating On</h2>
          {collabProjects.length === 0 ? (
            <p className="text-gray-600">You’re not collaborating on any projects.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {collabProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={(e) => handleProjectClick(e, proj.name, proj.owner)}
                  className="cursor-pointer bg-notion-offwhite shadow-sm rounded-lg p-6 hover:shadow-md transition"
                >
                  <div className="hover:bg-gray-100 rounded-md transition">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-semibold">{proj.name}</h3>
                      <span className="ml-2 text-xs bg-gray-200 text-gray-900 px-2 py-1 rounded-full">
                        Collab
                      </span>
                    </div>
                    <p className="text-gray-600">
                      {proj.description || 'No description'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Collaborator Modal */}
      {isAddCollaboratorModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-notion-offwhite p-6 rounded-lg w-full max-w-md shadow-lg">
            <h3 className="text-xl font-semibold mb-4">
              Add Collaborator to {selectedProjectName}
            </h3>
            <input
              type="text"
              placeholder="GitHub Username (e.g., johnDoe)"
              value={collaboratorUsername}
              onChange={(e) => setCollaboratorUsername(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
            {addCollaboratorError && (
              <p className="text-red-600 text-sm mb-4">{addCollaboratorError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsAddCollaboratorModalOpen(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCollaboratorSubmit}
                className={`bg-gray-900 text-white px-4 py-2 rounded-md font-medium hover:bg-gray-700 transition ${
                  isAddingCollaborator ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isAddingCollaborator}
              >
                {isAddingCollaborator ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Collaborator Modal */}
      {isRemoveCollaboratorModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-notion-offwhite p-6 rounded-lg w-full max-w-md shadow-lg">
            <h3 className="text-xl font-semibold mb-4">
              Remove Collaborator from {selectedProjectName}
            </h3>
            <input
              type="text"
              placeholder="GitHub Username (e.g., johnDoe)"
              value={removeCollaboratorUsername}
              onChange={(e) => setRemoveCollaboratorUsername(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
            {removeCollaboratorError && (
              <p className="text-red-600 text-sm mb-4">{removeCollaboratorError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsRemoveCollaboratorModalOpen(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveCollaboratorSubmit}
                className={`bg-gray-900 text-white px-4 py-2 rounded-md font-medium hover:bg-gray-700 transition ${
                  isRemovingCollaborator ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isRemovingCollaborator}
              >
                {isRemovingCollaborator ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;