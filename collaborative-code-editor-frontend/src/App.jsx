import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import CreateProject from './pages/CreateProject'; 
import ProjectWorkspace from "./pages/ProjectWorkspace";
import HomePage from './pages/HomePage';
import AboutContact from './pages/AboutContact';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

function App() {
  return (
    <Router>
      <Routes>
        <Route path = "/" element = {<HomePage/>}/>
        <Route path="/about" element={<AboutContact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/create" element={<CreateProject />} />     
        <Route path="/project/:projectId" element={<ProjectWorkspace />} />
      </Routes>
    </Router>
  );
}

export default App;
