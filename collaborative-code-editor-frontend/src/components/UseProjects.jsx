import { useState, useEffect } from 'react';
import axios from 'axios';

const useProjects = (token) => {
  const [ownedProjects, setOwnedProjects] = useState([]);
  const [collabProjects, setCollabProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;

    const fetchProjects = async () => {
      try {
        setLoading(true);
        const [ownedRes, collabRes] = await Promise.all([
          axios.get('/projects/owned', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('/projects/collaborating', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        // Ensure ownedProjects and collabProjects are arrays
        setOwnedProjects(Array.isArray(ownedRes.data) ? ownedRes.data : []);
        setCollabProjects(Array.isArray(collabRes.data) ? collabRes.data : []);
      } catch (err) {
        setError('Error fetching projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [token]);

  return { ownedProjects, collabProjects, loading, error };
};

export default useProjects;
