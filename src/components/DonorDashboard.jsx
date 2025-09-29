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

          {/* Blood Type Breakdown Section */}
          <div className={`${colors.bg.card} rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 mt-8 ${colors.border.primary} border`}>
            <h2 className={`text-lg sm:text-xl font-bold mb-4 text-center ${colors.text.primary}`}>Blood Type Breakdown</h2>
            {/* Sample size */}
            <div className="text-center mb-2 text-sm text-gray-500">
              Sample size: {donors.filter(d => d.bloodType && d.animalType).length}
            </div>
            <div className="flex flex-col md:flex-row gap-8 justify-center">
              {/* Dog Blood Types */}
              <div className="flex-1">
                <h3 className={`font-semibold mb-2 ${colors.text.primary}`}>Dogs</h3>
                <ul className="space-y-1">
                  {['DEA 1.1 Positive', 'DEA 1.1 Negative'].map(type => {
                    const dogDonors = donors.filter(d => d.animalType?.toLowerCase() === 'dog' && d.bloodType);
                    const count = dogDonors.filter(d => d.bloodType === type).length;
                    const percent = dogDonors.length ? Math.round((count / dogDonors.length) * 100) : 0;
                    return (
                      <li key={type} className="flex justify-between border-b border-dashed py-1">
                        <span className={colors.text.secondary}>{type}</span>
                        <span className="font-bold text-blue-500">{count} <span className="text-xs">({percent}%)</span></span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {/* Cat Blood Types */}
              <div className="flex-1">
                <h3 className={`font-semibold mb-2 ${colors.text.primary}`}>Cats</h3>
                <ul className="space-y-1">
                  {['A', 'AB', 'B'].map(type => {
                    const catDonors = donors.filter(d => d.animalType?.toLowerCase() === 'cat' && d.bloodType);
                    const count = catDonors.filter(d => d.bloodType === type).length;
                    const percent = catDonors.length ? Math.round((count / catDonors.length) * 100) : 0;
                    return (
                      <li key={type} className="flex justify-between border-b border-dashed py-1">
                        <span className={colors.text.secondary}>{type}</span>
                        <span className="font-bold text-pink-500">{count} <span className="text-xs">({percent}%)</span></span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonorDashboard;
