import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    console.log("Logging out...");

    const accessToken = localStorage.getItem("token");
    const githubLogin = localStorage.getItem("githubLogin");

    if (!githubLogin) {
      alert("Account details missing. Please log in again.");
      navigate("/login");
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({ githubLogin }),
        credentials: "include",
      });

      if (!response.ok) {
        let errorMessage = "Unknown error occurred during logout.";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage = await response.text() || errorMessage;
          }
        } catch (e) {
          console.error("Error parsing response:", e);
        }
        throw new Error(`Logout failed: ${errorMessage}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        console.log("Logout response:", data.message);
      }

      console.log("Logged out successfully");
      localStorage.clear();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error.message);
      alert(error.message);
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
            CodeSphere
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
