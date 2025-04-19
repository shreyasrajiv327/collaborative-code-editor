import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar'; // Adjust path based on your structure

const CreateProject = () => {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectLanguage, setProjectLanguage] = useState('');
  const [collaborators, setCollaborators] = useState('');
  const navigate = useNavigate();

  const handleRepoCreation = async () => {
    const accessToken = localStorage.getItem('token');

    if (!accessToken) {
      toast.error('Access token missing. Please log in again.');
      return;
    }

    try {
      const collaboratorsArray = collaborators
        .split(',')
        .map((username) => username.trim())
        .filter((username) => username); // Remove empty entries

      const projectData = new URLSearchParams({
        name: projectName,
        description: projectDescription,
        language: projectLanguage,
        collaboratorUsernames: collaboratorsArray.join(','),
      });

      console.log('Sending the following data to the backend:', {
        accessToken,
        projectData: projectData.toString(),
      });

      const response = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${accessToken}`,
        },
        body: projectData,
      });

      if (response.ok) {
        toast.success('Project created successfully!');
        setTimeout(() => {
          navigate('/dashboard');
        }, 100);
      } else {
        toast.error('Error creating project.');
        setTimeout(() => {
          navigate('/dashboard');
        }, 100);
      }
    } catch (error) {
      console.error('Error during repo creation:', error);
      toast.error('Failed to create project. Please try again.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleRepoCreation();
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-2xl">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center tracking-tight">
          Create a New Project
        </h2>
        <div className="bg-white shadow-lg rounded-2xl p-8 transition-all duration-300 hover:shadow-xl">
          <form onSubmit={handleSubmit}>
            {/* Project Name */}
            <div className="mb-6">
              <label
                htmlFor="projectName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Project Name
              </label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                required
              />
            </div>

            {/* Project Description */}
            <div className="mb-6">
              <label
                htmlFor="projectDescription"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Project Description
              </label>
              <textarea
                id="projectDescription"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                rows="4"
                required
              />
            </div>

            {/* Language */}
            <div className="mb-6">
              <label
                htmlFor="projectLanguage"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Language
              </label>
              <input
                type="text"
                id="projectLanguage"
                value={projectLanguage}
                onChange={(e) => setProjectLanguage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                required
              />
            </div>

            {/* Collaborators */}
            <div className="mb-6">
              <label
                htmlFor="collaborators"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Collaborators (comma-separated GitHub usernames)
              </label>
              <input
                type="text"
                id="collaborators"
                value={collaborators}
                onChange={(e) => setCollaborators(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                placeholder="user1, user2"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Create Project
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProject;