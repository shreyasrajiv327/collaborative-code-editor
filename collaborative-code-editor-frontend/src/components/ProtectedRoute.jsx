// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('authenticated'); // Check if authenticated

  if (!isAuthenticated) {
    // If not authenticated, redirect to login page
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;
