import React from "react";

const LoginButton = () => {
  const handleLogin = () => {
    // Redirect directly to the OAuth2 login page handled by Spring Security
    window.location.href = "http://localhost:8080/oauth2/authorization/github"; // Add backend URL here
  };

  return (
    <button onClick={handleLogin}>
      Login with GitHub
    </button>
  );
};

export default LoginButton;
