import { useState } from "react";
import { useNavigate } from "react-router-dom";

const CreateProject = () => {
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLanguage, setProjectLanguage] = useState("");
  const [collaborators, setCollaborators] = useState(""); // Comma-separated string
  const navigate = useNavigate();

  const handleRepoCreation = async () => {
    const accessToken = localStorage.getItem("token");
  
    if (!accessToken) {
      alert("Access token missing. Please log in again.");
      return;
    }
  
    try {
      // Split the collaborators string into an array of usernames
      const collaboratorsArray = collaborators.split(",").map((username) => username.trim());
  
      const projectData = new URLSearchParams({
        name: projectName,
        description: projectDescription,
        language: projectLanguage,
        collaboratorUsernames: collaboratorsArray.join(","),
      });
  
      // Log the project data being sent
      console.log("Sending the following data to the backend:", {
        accessToken,
        projectData,
      });
  
      const response = await fetch("/api/github/create-repo", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: projectData,
      });
      
      if (response.ok) {
        alert("Project created successfully!");
        setTimeout(() => {
          navigate("/dashboard");
        }, 100);
      } else {  
        alert("Error creating project.");
        setTimeout(() => {
          navigate("/dashboard");
        }, 100);
      }
    } catch (error) {
      console.error("Error during repo creation:", error);
    }
  };  

  const handleSubmit = (e) => {
    e.preventDefault();
    handleRepoCreation(); // First create the repo, then save the project details
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold mb-6">Create a New Project</h2>
      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div className="mb-4">
          <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">Project Name</label>
          <input
            type="text"
            id="projectName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="border p-2 rounded w-full mt-1"
            required
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700">Project Description</label>
          <textarea
            id="projectDescription"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            className="border p-2 rounded w-full mt-1"
            rows="4"
            required
          />
        </div>

        {/* Language */}
        <div className="mb-4">
          <label htmlFor="projectLanguage" className="block text-sm font-medium text-gray-700">Language</label>
          <input
            type="text"
            id="projectLanguage"
            value={projectLanguage}
            onChange={(e) => setProjectLanguage(e.target.value)}
            className="border p-2 rounded w-full mt-1"
            required
          />
        </div>

        {/* Collaborators */}
        <div className="mb-4">
          <label htmlFor="collaborators" className="block text-sm font-medium text-gray-700">
            Collaborators (comma-separated GitHub usernames)
          </label>
          <input
            type="text"
            id="collaborators"
            value={collaborators}
            onChange={(e) => setCollaborators(e.target.value)}
            className="border p-2 rounded w-full mt-1"
            placeholder="user1, user2"
          />
        </div>

        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg w-full hover:bg-blue-700">
          Create Project
        </button>
      </form>
    </div>
  );
};

export default CreateProject;
