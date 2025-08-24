import React from "react";
import DonorPivotTable from "./DonorPivotTable";
import { donorStorage } from '../utils/storage.js';

const DonorDashboard = () => {
  const donors = donorStorage.getDonors();

  const handleUnknownClick = (animalType, month) => {
    alert(`ערוך נתוני ${animalType} לא ידוע לחודש ${month}`);
    // כאן תעשה מה שתרצה: לפתוח מודאל, לעבור לדף עריכה וכו’
  };

  return (
    <div className="p-4">
      <DonorPivotTable donors={donors} onUnknownClick={handleUnknownClick} />
    </div>
  );
};

export default DonorDashboard;
