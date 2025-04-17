// import React from 'react';
// import { useNavigate } from 'react-router-dom';

// const Home = () => {
//   const navigate = useNavigate();

//   return (
//     <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
//       <h1 className="text-4xl font-bold mb-10 text-gray-800">Welcome to CodeCollab</h1>
      
//       <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
//         <button
//           onClick={() => navigate('/create')}
//           className="w-72 h-40 bg-white shadow-xl rounded-2xl p-6 hover:bg-blue-50 transition border border-gray-200"
//         >
//           <h2 className="text-2xl font-semibold text-blue-600">Create New Project</h2>
//           <p className="text-gray-500 mt-2">Start from scratch and set up a new repo.</p>
//         </button>

//         <button
//           onClick={() => navigate('/projects')}
//           className="w-72 h-40 bg-white shadow-xl rounded-2xl p-6 hover:bg-green-50 transition border border-gray-200"
//         >
//           <h2 className="text-2xl font-semibold text-green-600">View Existing Projects</h2>
//           <p className="text-gray-500 mt-2">Browse and manage your current projects.</p>
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Home;
import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-10 text-gray-800">Welcome to CodeCollab</h1>
      
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <button
          onClick={() => navigate('/create')}
          className="w-72 h-40 bg-white shadow-xl rounded-2xl p-6 hover:bg-blue-50 transition border border-gray-200"
        >
          <h2 className="text-2xl font-semibold text-blue-600">Create New Project</h2>
          <p className="text-gray-500 mt-2">Start from scratch and set up a new repo.</p>
        </button>

        <button
          onClick={() => navigate('/projects')}
          className="w-72 h-40 bg-white shadow-xl rounded-2xl p-6 hover:bg-green-50 transition border border-gray-200"
        >
          <h2 className="text-2xl font-semibold text-green-600">View Existing Projects</h2>
          <p className="text-gray-500 mt-2">Browse and manage your current projects.</p>
        </button>
      </div>
    </div>
  );
};

export default HomePage;
