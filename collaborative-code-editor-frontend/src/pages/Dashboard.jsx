// Dashboard.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar'; // adjust path based on your structure

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const userDetails = {};

    queryParams.forEach((value, key) => {
      userDetails[key] = value;
    });

    // if (!userDetails.name || !userDetails.avatarUrl || !userDetails.githubLogin) {
    //   console.log("IM HERE IN DASHBOARD WITH NO USER DETAILS");
    //   navigate('/');
    //   return;
    // }


    if (userDetails.token) {
      console.log('Setting access token:', userDetails.token);
      queryParams.forEach((value, key) => {
        userDetails[key] = value;
        localStorage.setItem(key, value);
      });
      console.log("local storage in dashboard", localStorage);
    }

    const name = localStorage.getItem('name');
    const avatarUrl = localStorage.getItem('avatarUrl');
    const githubLogin = localStorage.getItem('githubLogin');
    if (!name || !avatarUrl || !githubLogin) {
      console.log("IM HERE IN DASHBOARD WITH NO USER DETAILS (from localStorage)");
      navigate('/');
      return;
    }

    setUser({
      name: localStorage.getItem('name'),
      avatarUrl: localStorage.getItem('avatarUrl'),
      githubLogin: localStorage.getItem('githubLogin'),
      githubUrl: localStorage.getItem('githubUrl'),
      email: localStorage.getItem('email'),
      token: localStorage.getItem('token'),
    });

    
  }, [location, navigate]);

  const handleCreateProject = () => {
    navigate('/create');
  };

  const handleViewProjects = () => {
    navigate('/projects');
  };

  if (!user) return <div className="text-center mt-10">Loading...</div>;

  return (
    <div>
      <Navbar />
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-4">Welcome, {user.name} 👋</h1>
        <img src={user.avatarUrl} alt="Avatar" className="rounded-full w-20 h-20 mb-4" />
        <p className="text-lg text-gray-600">GitHub Login: {user.githubLogin}</p>
        <p className="text-lg text-gray-600">
          GitHub URL:{' '}
          <a
            href={user.githubUrl}
            className="text-blue-500 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {user.githubUrl}
          </a>
        </p>
        <p className="text-lg text-gray-600">Email: {user.email || 'Not provided'}</p>

        <button
          onClick={handleCreateProject}
          className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Create New Project
        </button>

        <button
          onClick={handleViewProjects}
          className="mt-6 ml-4 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
        >
          View My Projects
        </button>
      </div>
    </div>
  );
};

export default Dashboard;