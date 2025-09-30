import React from "react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import DonorPivotTable from "./DonorPivotTable";
import { donorStorage } from '../utils/storage.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

const DonorDashboard = () => {
  const { colors } = useTheme();
  const donors = donorStorage.getDonors();


  // Pie chart colors
  const dogColors = ['#3b82f6', '#f59e42'];
  const catColors = ['#ec4899', '#fbbf24', '#6366f1'];

  // Blood type breakdown
  const dogDonors = donors.filter(d => d.animalType?.toLowerCase() === 'dog' && d.bloodType);
  const catDonors = donors.filter(d => d.animalType?.toLowerCase() === 'cat' && d.bloodType);
  const dogTypes = ['DEA 1.1 Positive', 'DEA 1.1 Negative'];
  const catTypes = ['A', 'AB', 'B'];
  const dogData = dogTypes.map((type) => ({
    name: type,
    value: dogDonors.filter(d => d.bloodType === type).length
  }));
  const catData = catTypes.map((type) => ({
    name: type,
    value: catDonors.filter(d => d.bloodType === type).length
  }));

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
          


          {/* Monthly Statistics Table */}
          <div className={`${colors.bg.gradient} rounded-xl sm:rounded-2xl p-2 sm:p-4 mb-8`}>
            <DonorPivotTable donors={donors} />
          </div>

          {/* Blood Type Breakdown Section */}
          <div className={`${colors.bg.card} rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 mt-8 ${colors.border.primary} border`}>
            <h2 className={`text-lg sm:text-xl font-bold mb-4 text-center ${colors.text.primary}`}>Blood Type Statistics</h2>
            <div className="flex flex-col md:flex-row gap-8 justify-center">
              {/* Dog Pie Chart & Stats */}
              <div className="flex-1 flex flex-col items-center">
                <h3 className={`font-semibold mb-2 ${colors.text.primary}`}>Dogs <span className="text-xs text-gray-500">(n={dogDonors.length})</span></h3>
                <ResponsiveContainer width="100%" height={180} minWidth={180} minHeight={180}>
                  <PieChart>
                    <Pie 
                      data={dogData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" cy="50%" 
                      outerRadius={60} 
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, value, percent }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.7;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fontSize={16}>
                            {dogDonors.length ? `${Math.round((value / dogDonors.length) * 100)}%` : ''}
                          </text>
                        );
                      }}
                      labelLine={false}
                    >
                      {dogData.map((entry, idx) => <Cell key={`cell-dog-${idx}`} fill={dogColors[idx % dogColors.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-1 w-full max-w-xs mt-2">
                  {dogData.map((item, idx) => {
                    const percent = dogDonors.length ? Math.round((item.value / dogDonors.length) * 100) : 0;
                    return (
                      <li key={item.name} className="flex justify-between border-b border-dashed py-1">
                        <span className={colors.text.secondary}>{item.name}</span>
                        <span className="font-bold text-blue-500">{percent}% <span className="text-xs">({item.value})</span></span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {/* Cat Pie Chart & Stats */}
              <div className="flex-1 flex flex-col items-center">
                <h3 className={`font-semibold mb-2 ${colors.text.primary}`}>Cats <span className="text-xs text-gray-500">(n={catDonors.length})</span></h3>
                <ResponsiveContainer width="100%" height={180} minWidth={180} minHeight={180}>
                  <PieChart>
                    <Pie 
                      data={catData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" cy="50%" 
                      outerRadius={60} 
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, value, percent }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.7;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fontSize={16}>
                            {catDonors.length ? `${Math.round((value / catDonors.length) * 100)}%` : ''}
                          </text>
                        );
                      }}
                      labelLine={false}
                    >
                      {catData.map((entry, idx) => <Cell key={`cell-cat-${idx}`} fill={catColors[idx % catColors.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-1 w-full max-w-xs mt-2">
                  {catData.map((item, idx) => {
                    const percent = catDonors.length ? Math.round((item.value / catDonors.length) * 100) : 0;
                    return (
                      <li key={item.name} className="flex justify-between border-b border-dashed py-1">
                        <span className={colors.text.secondary}>{item.name}</span>
                        <span className="font-bold text-pink-500">{percent}% <span className="text-xs">({item.value})</span></span>
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
