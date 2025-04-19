import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    console.log("Logging out...");
  
    const accessToken = localStorage.getItem("token");
    const githubLogin = localStorage.getItem("githubLogin");
  
    if (!accessToken) {
      alert("Access token missing. Please log in again.");
      return;
    }
  
    if (!githubLogin) {
      alert("Account details missing. Please log in again.");
      return;
    }
  
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          githubLogin: githubLogin
        })
      });
  
      if (!response.ok) {
        const errorText = await response.text(); // fallback for non-JSON
        throw new Error(errorText || "Unknown error occurred during logout.");
      }
  
      // Try to parse the JSON safely
      let data = {};
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
        console.log(data.message);
      }
  
      console.log("Logged out");
  
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('name');
      localStorage.removeItem('avatarUrl');
      localStorage.removeItem('githubLogin');
      localStorage.removeItem('githubUrl');
      localStorage.removeItem('email');
  
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error.message);
    }
  };
  

  return (
    <nav className="bg-black shadow-sm py-4 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl flex items-center justify-between">
        <div
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() => navigate('/dashboard')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard')}
          aria-label="Navigate to dashboard"
        >
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Collaborative Code Editor
          </h1>
        </div>
        <div>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
// import { useNavigate } from 'react-router-dom';

// const Navbar = () => {
//   const navigate = useNavigate();

//   const handleLogout = async () => {
//     const accessToken = localStorage.getItem("token");
  
//     if (!accessToken) {
//       alert("Access token missing. Please log in again.");
//       return;
//     }
//     try {
//       // Call the backend logout endpoint
//       await fetch('/api/auth/logout', {
//         method: 'POST',
//         headers: {
//           "Authorization": `Bearer ${accessToken}`,
//         },
//       });

//       console.log("Logged out");
  
//       // Remove tokens or session data from localStorage
//       localStorage.removeItem('token');
//       localStorage.removeItem('name');
//       localStorage.removeItem('avatarUrl');
//       localStorage.removeItem('githubLogin');
//       localStorage.removeItem('githubUrl');
//       localStorage.removeItem('email');
  
//       // Redirect to the home page (login)
//       navigate('/');
//     } catch (error) {
//       console.error('Logout failed', error);
//     }
//   };

//   return (
//     <nav className="flex justify-between items-center p-4 bg-gray-800 text-white">
//       <div className="text-xl font-semibold">Collaborative Code Editor</div>
//       <div>
//         <button
//           onClick={handleLogout}
//           className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
//         >
//           Logout
//         </button>
//       </div>
//     </nav>
//   );
// };

// export default Navbar;