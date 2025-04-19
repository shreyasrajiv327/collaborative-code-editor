import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Projects from './Projects';


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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Greeting + User Info */}
        <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-2xl p-8 mb-10">
          <div className="flex flex-col items-center text-center">
            <img
              src={user.avatarUrl}
              alt="Avatar"
              className="rounded-full w-24 h-24 mb-4 border-4 border-gray-200 shadow"
            />
            <h2 className="text-2xl font-bold mb-1">Hello, {user.name} 👋</h2>
            <p className="text-gray-600 text-sm mb-2">
              <span className="font-medium text-gray-800">GitHub Login:</span> {user.githubLogin}
            </p>
            <p className="text-gray-600 text-sm">
              <span className="font-medium text-gray-800">GitHub URL:</span>{' '}
              <a
                href={user.githubUrl}
                className="text-blue-500 hover:text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {user.githubUrl}
              </a>
            </p>
          </div>
        </div>

        {/* Projects Section */}
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-center mb-6">
            <button
              onClick={handleCreateProject}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition duration-200"
            >
              + Create New Project
            </button>
          </div>
          <Projects />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
