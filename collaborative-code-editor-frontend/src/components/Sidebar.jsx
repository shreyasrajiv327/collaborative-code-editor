import React from "react";

const Sidebar = () => {
  return (
    <div className="bg-gray-100 p-4 w-1/4">
      <h2 className="text-lg font-semibold">Navigation</h2>
      <ul>
        <li><a href="#">Dashboard</a></li>
        <li><a href="#">Projects</a></li>
        <li><a href="#">Collaborators</a></li>
      </ul>
    </div>
  );
};

export default Sidebar;
