import React from "react";
import { Link, useLocation } from "react-router-dom";

const Navigation = () => {
  const location = useLocation();
  const isOwnerPage = location.pathname === "/owners";

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-2 flex justify-between items-center">
        <div className="text-xl font-bold">
          <Link to="/">דף הבית</Link>
        </div>
        <div className="flex gap-4">
          <Link to="/"
            className={`px-3 py-2 rounded-md text-sm font-medium ${!isOwnerPage ? "bg-blue-600 text-white" : "text-blue-600"}`}
          >
            תרומות קרובות
          </Link>
          <Link to="/owners"
            className={`px-3 py-2 rounded-md text-sm font-medium ${isOwnerPage ? "bg-blue-600 text-white" : "text-blue-600"}`}
          >
            OWNERS
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;