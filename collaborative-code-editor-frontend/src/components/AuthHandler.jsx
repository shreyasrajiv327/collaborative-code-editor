import React, { useEffect, useState } from "react";

const AuthHandler = () => {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("Fetching user info...");
    fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.token) {
          setToken(data.token);
          localStorage.setItem("authToken", data.token);
        } else {
          setError("No token found in the response");
        }
      })
      .catch((err) => {
        console.error("Error fetching user info:", err);
        setError("Failed to fetch user info: " + err.message);
      });
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (token) {
    return <div>Logged in successfully!</div>;
  } else {
    return <div>Loading...</div>;
  }
};

export default AuthHandler;
