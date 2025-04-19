import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const userDetails = {};

    // Read query parameters
    queryParams.forEach((value, key) => {
      userDetails[key] = value;
    });

    // Save to localStorage if token exists
    if (userDetails.token) {
      console.log('Setting access token:', userDetails.token);
      queryParams.forEach((value, key) => {
        localStorage.setItem(key, value);
      });
      console.log('localStorage in dashboard:', localStorage);
    }

    // Check for essential auth data
    const token = localStorage.getItem('token');
    const githubLogin = localStorage.getItem('githubLogin');
    const avatarUrl = localStorage.getItem('avatarUrl');
    if (!token || !githubLogin) {
      console.log('Missing token or githubLogin, redirecting to login');
      navigate('/');
      return;
    }

    // Set user state, generate GitHub URL dynamically
    setUser({
      name: localStorage.getItem('name') || 'Unknown',
      avatarUrl: avatarUrl,
      githubLogin: githubLogin,
      githubUrl: `https://www.github.com/${githubLogin}`,
      token: token,
    });
  }, [location, navigate]);

  const handleCreateProject = () => {
    navigate('/create');
  };

  const handleViewProjects = () => {
    navigate('/projects');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500 text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-2xl">
        <h2 className="text-2xl font-semibold text-gray-900 mb-8 text-center tracking-tight">
          Hello, {user.name} 👋
        </h2>
        <div className="bg-white shadow-lg rounded-2xl p-8 transition-all duration-300 hover:shadow-xl">
          <div className="flex flex-col items-center">
            <img
              src={user.avatarUrl}
              alt="Avatar"
              className="rounded-full w-24 h-24 mb-6 border-4 border-gray-100 shadow-sm transform hover:scale-105 transition-transform duration-200"
            />
            <div className="text-center space-y-3">
              <p className="text-gray-600 text-sm">
                <span className="font-medium text-gray-800">GitHub Login:</span> {user.githubLogin}
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-medium text-gray-800">GitHub URL:</span>{' '}
                <a
                  href={user.githubUrl}
                  className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {user.githubUrl}
                </a>
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={handleCreateProject}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Create New Project
            </button>
            <button
              onClick={handleViewProjects}
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              View My Projects
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
