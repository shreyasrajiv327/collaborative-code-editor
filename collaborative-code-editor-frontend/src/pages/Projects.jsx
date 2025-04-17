import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Projects = () => {
  const [ownedProjects, setOwnedProjects] = useState([]);
  const [collabProjects, setCollabProjects] = useState([]);
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
          'Authorization': `Bearer ${accessToken}`,
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
        console.log("ownedData:", ownedData);
        console.log("collabData:", collabData);

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

  const handleAddCollaborator = async (projectName) => {
    const collaboratorUsername = prompt(`Enter the GitHub username to add to "${projectName}":`);
    if (!collaboratorUsername || collaboratorUsername.trim() === '') {
      alert('Invalid GitHub username');
      return;
    }

    const accessToken = localStorage.getItem('token');
    if (!accessToken) {
      alert('Access token missing. Please log in again.');
      return;
    }

    try {
      const response = await fetch('http://localhost:8080/api/github/add-collaborator', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          repoName: projectName,
          collaboratorUsername,
        }),
      });

      const message = await response.text();
      if (!response.ok) {
        throw new Error(message);
      }

      alert(message);
    } catch (error) {
      console.error('Error adding collaborator:', error);
      alert(`❌ Failed to add collaborator: ${error.message}`);
    }
  };

  const handleRemoveCollaborator = (projectName) => {
    console.log('Remove collaborator from:', projectName);
    // implement logic or modal trigger
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Your Projects</h1>

      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Owned Projects</h2>
        {ownedProjects.length === 0 ? (
          <p className="text-gray-500">You don't own any projects yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownedProjects.map((proj) => (
              <div
                key={proj._id}
                onClick={(e) => handleProjectClick(e, proj.name, proj.owner)}
                className="cursor-pointer border rounded-2xl p-4 shadow-md hover:shadow-lg transition bg-white"
              >
                <h3 className="text-lg font-semibold">{proj.name}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {proj.description || 'No description'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddCollaborator(proj.name)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    Add Collaborator
                  </button>
                  <button
                    onClick={() => handleRemoveCollaborator(proj.name)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    Remove Collaborator
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4">Collaborating On</h2>
        {collabProjects.length === 0 ? (
          <p className="text-gray-500">You're not collaborating on any projects.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collabProjects.map((proj) => (
              <div
                key={proj.id}
                onClick={(e) => handleProjectClick(e, proj.name, proj.owner)}
                className="cursor-pointer border rounded-2xl p-4 shadow-md hover:shadow-lg transition bg-white"
              >
                <h3 className="text-lg font-semibold">{proj.name}</h3>
                <p className="text-sm text-gray-600">
                  {proj.description || 'No description'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;


// import React, { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';

// const Projects = () => {
//   const [ownedProjects, setOwnedProjects] = useState([]);
//   const [collabProjects, setCollabProjects] = useState([]);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const accessToken = localStorage.getItem('token');
//     if (!accessToken) {
//       alert('Access token missing. Please log in again.');
//       return;
//     }

//     const fetchProjects = async () => {
//       try {
//         const headers = {
//           'Authorization': `Bearer ${accessToken}`,
//         };

//         const [ownedRes, collabRes] = await Promise.all([
//           fetch('/api/projects/owned', { method: 'GET', headers }),
//           fetch('/api/projects/collaborating', { method: 'GET', headers }),
//         ]);

//         if (!ownedRes.ok || !collabRes.ok) {
//           throw new Error(`Failed to fetch projects: Owned=${ownedRes.status}, Collab=${collabRes.status}`);
//         }

//         const ownedData = await ownedRes.json();
//         const collabData = await collabRes.json();
//         console.log("ownedData:", ownedData);
//         console.log("collabData:", collabData);

//         setOwnedProjects(Array.isArray(ownedData) ? ownedData : []);
//         setCollabProjects(Array.isArray(collabData) ? collabData : []);
//       } catch (error) {
//         console.error('Error fetching projects:', error);
//         setOwnedProjects([]);
//         setCollabProjects([]);
//       }
//     };

//     fetchProjects();
//   }, []);

//   const handleProjectClick = (e, projectName, owner) => {
//     // Avoid navigating if the click is from a button inside the card
//     if (e.target.tagName.toLowerCase() === 'button') return;
//     // Navigate with owner as a query parameter
//     navigate(`/project/${projectName}?owner=${encodeURIComponent(owner)}`);
//   };

//   const handleAddCollaborator = (projectName) => {
//     console.log('Add collaborator to:', projectName);
//     // implement logic or modal trigger
//   };

//   const handleRemoveCollaborator = (projectName) => {
//     console.log('Remove collaborator from:', projectName);
//     // implement logic or modal trigger
//   };

//   return (
//     <div className="p-8">
//       <h1 className="text-2xl font-semibold mb-4">Your Projects</h1>

//       <div className="mt-10">
//         <h2 className="text-xl font-bold mb-4">Owned Projects</h2>
//         {ownedProjects.length === 0 ? (
//           <p className="text-gray-500">You don't own any projects yet.</p>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {ownedProjects.map((proj) => (
//               <div
//                 key={proj._id}
//                 onClick={(e) => handleProjectClick(e, proj.name, proj.owner)} // Pass owner
//                 className="cursor-pointer border rounded-2xl p-4 shadow-md hover:shadow-lg transition bg-white"
//               >
//                 <h3 className="text-lg font-semibold">{proj.name}</h3>
//                 <p className="text-sm text-gray-600 mb-4">
//                   {proj.description || 'No description'}
//                 </p>
//                 <div className="flex gap-2">
//                   <button
//                     onClick={() => handleAddCollaborator(proj.name)}
//                     className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
//                   >
//                     Add Collaborator
//                   </button>
//                   <button
//                     onClick={() => handleRemoveCollaborator(proj.name)}
//                     className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
//                   >
//                     Remove Collaborator
//                   </button>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>

//       <div className="mt-12">
//         <h2 className="text-xl font-bold mb-4">Collaborating On</h2>
//         {collabProjects.length === 0 ? (
//           <p className="text-gray-500">You're not collaborating on any projects.</p>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {collabProjects.map((proj) => (
//               <div
//                 key={proj.id}
//                 onClick={(e) => handleProjectClick(e, proj.name, proj.owner)} // Pass owner
//                 className="cursor-pointer border rounded-2xl p-4 shadow-md hover:shadow-lg transition bg-white"
//               >
//                 <h3 className="text-lg font-semibold">{proj.name}</h3>
//                 <p className="text-sm text-gray-600">
//                   {proj.description || 'No description'}
//                 </p>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default Projects;


// import React, { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';

// const Projects = () => {
//   const [ownedProjects, setOwnedProjects] = useState([]);
//   const [collabProjects, setCollabProjects] = useState([]);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const accessToken = localStorage.getItem('token');
//     if (!accessToken) {
//       alert('Access token missing. Please log in again.');
//       return;
//     }

//     const fetchProjects = async () => {
//       try {
//         const headers = {
//           'Authorization': `Bearer ${accessToken}`,
//         };

//         const [ownedRes, collabRes] = await Promise.all([
//           fetch('/api/projects/owned', { method: 'GET', headers }),
//           fetch('/api/projects/collaborating', { method: 'GET', headers }),
//         ]);

//         if (!ownedRes.ok || !collabRes.ok) {
//           throw new Error(`Failed to fetch projects: Owned=${ownedRes.status}, Collab=${collabRes.status}`);
//         }

//         const ownedData = await ownedRes.json();
//         const collabData = await collabRes.json();
//         console.log("ownedData:", ownedData);
//         console.log("collabData:", collabData);

//         setOwnedProjects(Array.isArray(ownedData) ? ownedData : []);
//         setCollabProjects(Array.isArray(collabData) ? collabData : []);
//       } catch (error) {
//         console.error('Error fetching projects:', error);
//         setOwnedProjects([]);
//         setCollabProjects([]);
//       }
//     };

//     fetchProjects();
//   }, []);

//   const handleProjectClick = (e, projectName) => {
//     // Avoid navigating if the click is from a button inside the card
//     if (e.target.tagName.toLowerCase() === 'button') return;
//     navigate(`/project/${projectName}`);
//   };

//   const handleAddCollaborator = (projectName) => {
//     console.log('Add collaborator to:', projectName);
//     // implement logic or modal trigger
//   };

//   const handleRemoveCollaborator = (projectName) => {
//     console.log('Remove collaborator from:', projectName);
//     // implement logic or modal trigger
//   };

//   return (
//     <div className="p-8">
//       <h1 className="text-2xl font-semibold mb-4">Your Projects</h1>

//       <div className="mt-10">
//         <h2 className="text-xl font-bold mb-4">Owned Projects</h2>
//         {ownedProjects.length === 0 ? (
//           <p className="text-gray-500">You don't own any projects yet.</p>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {ownedProjects.map((proj) => (
//               <div
//                 key={proj._id}
//                 onClick={(e) => handleProjectClick(e, proj.name)}
//                 className="cursor-pointer border rounded-2xl p-4 shadow-md hover:shadow-lg transition bg-white"
//               >
//                 <h3 className="text-lg font-semibold">{proj.name}</h3>
//                 <p className="text-sm text-gray-600 mb-4">
//                   {proj.description || 'No description'}
//                 </p>
//                 <div className="flex gap-2">
//                   <button
//                     onClick={() => handleAddCollaborator(proj.name)}
//                     className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
//                   >
//                     Add Collaborator
//                   </button>
//                   <button
//                     onClick={() => handleRemoveCollaborator(proj.name)}
//                     className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
//                   >
//                     Remove Collaborator
//                   </button>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>

//       <div className="mt-12">
//         <h2 className="text-xl font-bold mb-4">Collaborating On</h2>
//         {collabProjects.length === 0 ? (
//           <p className="text-gray-500">You're not collaborating on any projects.</p>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {collabProjects.map((proj) => (
//               <div
//                 key={proj.id}
//                 onClick={(e) => handleProjectClick(e, proj.name)}
//                 className="cursor-pointer border rounded-2xl p-4 shadow-md hover:shadow-lg transition bg-white"
//               >
//                 <h3 className="text-lg font-semibold">{proj.name}</h3>
//                 <p className="text-sm text-gray-600">
//                   {proj.description || 'No description'}
//                 </p>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default Projects;
