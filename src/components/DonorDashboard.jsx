import React from "react";
import DonorPivotTable from "./DonorPivotTable";
import { donorStorage } from '../utils/storage.js';

const DonorDashboard = () => {
  const donors = donorStorage.getDonors();

  const handleUnknownClick = (animalType, month) => {
    alert(`ערוך נתוני ${animalType} לא ידוע לחודש ${month}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-blue-100">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Donor Dashboard
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full"></div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6">
            <DonorPivotTable donors={donors} onUnknownClick={handleUnknownClick} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonorDashboard;
