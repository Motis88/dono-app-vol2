import React from "react";
import DonorPivotTable from "./DonorPivotTable";
import { donorStorage } from '../utils/storage.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

const DonorDashboard = () => {
  const { colors } = useTheme();
  const donors = donorStorage.getDonors();

  const handleUnknownClick = (animalType, month) => {
    alert(`ערוך נתוני ${animalType} לא ידוע לחודש ${month}`);
  };

  return (
    <div className={`min-h-screen ${colors.bg.primary} p-2 sm:p-4`}>
      <div className="max-w-7xl mx-auto">
        <div className={`${colors.bg.card} rounded-2xl sm:rounded-3xl shadow-2xl p-3 sm:p-6 ${colors.border.primary} border`}>
          <div className="text-center mb-4 sm:mb-6">
            <h1 className={`text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 sm:mb-4`}>
              Donor Dashboard
            </h1>
            <div className="w-16 sm:w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full"></div>
          </div>
          
          <div className={`${colors.bg.gradient} rounded-xl sm:rounded-2xl p-2 sm:p-4`}>
            <DonorPivotTable donors={donors} onUnknownClick={handleUnknownClick} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonorDashboard;
