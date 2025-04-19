import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import CreateProject from './pages/CreateProject'; 
import ProjectWorkspace from "./pages/ProjectWorkspace";
import HomePage from './pages/HomePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path = "/" element = {<HomePage/>}/>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/create" element={<CreateProject />} />     
        <Route path="/project/:projectId" element={<ProjectWorkspace />} />
      </Routes>
    </Router>
  );
}

export default App;
