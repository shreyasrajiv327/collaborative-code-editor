import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const accessToken = localStorage.getItem("token");
  
    if (!accessToken) {
      alert("Access token missing. Please log in again.");
      return;
    }
    try {
      // Call the backend logout endpoint
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      console.log("Logged out");
  
      // Remove tokens or session data from localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('name');
      localStorage.removeItem('avatarUrl');
      localStorage.removeItem('githubLogin');
      localStorage.removeItem('githubUrl');
      localStorage.removeItem('email');
  
      // Redirect to the home page (login)
      navigate('/');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <nav className="flex justify-between items-center p-4 bg-gray-800 text-white">
      <div className="text-xl font-semibold">Collaborative Code Editor</div>
      <div>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;