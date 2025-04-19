import React from 'react';

const LoginPage = () => {
  const handleLogin = () => {
    // Clear old localStorage to avoid conflicts
    localStorage.removeItem('token');
    localStorage.removeItem('githubLogin');
    localStorage.removeItem('githubId');
    localStorage.removeItem('avatarUrl');
    localStorage.removeItem('name');
    localStorage.removeItem('email');
    localStorage.removeItem('githubUrl');
    // Redirect to Spring Boot GitHub OAuth endpoint
    window.location.href = 'http://localhost:8080/oauth2/authorization/github';
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-3xl mb-6 font-bold">Collaborative Code Editor</h1>
      <button
        onClick={handleLogin}
        className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition"
      >
        Login with GitHub
      </button>
    </div>
  );
};

export default LoginPage;


// import React from 'react';

// const LoginPage = () => {
//   const handleLogin = () => {
//     // Redirect to Spring Boot backend GitHub login endpoint
//     window.location.href = 'http://localhost:8080/';
//   };

//   return (
//     <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
//       <h1 className="text-3xl mb-6 font-bold">Collaborative Code Editor</h1>
//       <button
//         onClick={handleLogin}
//         className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition"
//       >
//         Login with GitHub
//       </button>
//     </div>
//   );
// };

// export default LoginPage;
