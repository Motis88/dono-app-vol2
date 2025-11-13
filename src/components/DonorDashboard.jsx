import React, { useState } from "react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import DonorPivotTable from "./DonorPivotTable";
import EnhancedDashboard from "./EnhancedDashboard";
import { donorStorage } from '../utils/storage.js';
import { useTheme } from '../contexts/ThemeContext.jsx';
import toast from 'react-hot-toast';

const DonorDashboard = ({ onLocationClick }) => {
  const { colors } = useTheme();
  const donors = donorStorage.getDonors();
  const [view, setView] = useState('overview'); // 'overview' or 'analytics'

  // Calculate key statistics
  const totalDonations = donors.filter(d => d.donated === 'Yes').length;
  const totalDonors = donors.length;
  const privateOwners = donors.filter(d => d.isPrivateOwner).length;
  
  // Calculate eligible donors (90+ days since last donation)
  const eligibleDonors = donors.filter(d => {
    if (!d.date) return false;
    const lastDate = new Date(d.date);
    const today = new Date();
    const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    return daysSince >= 90;
  }).length;

  // Pie chart colors
  const dogColors = ['#3b82f6', '#f59e42'];
  const catColors = ['#ec4899', '#fbbf24', '#6366f1'];

  // Helper function to identify unique animals
  const getUniqueAnimals = (animalsList) => {
    const seen = new Set();
    return animalsList.filter(animal => {
      // Create unique key: name + type + location (+ owner if private)
      const name = animal.animalName?.toLowerCase() || '';
      const type = animal.animalType?.toLowerCase() || '';
      const location = animal.location?.toLowerCase() || '';
      
      // Exception: Cats with numeric names from any location are considered different animals
      const isCat = type === 'cat' || type === 'חתול';
      const isNumericName = /^\d+$/.test(name.trim());
      
      if (isCat && isNumericName) {
        // For numeric cat names, treat each record as unique
        const uniqueKey = `${name}_${type}_${location}_${animal.date}_${animal.id}`;
        if (seen.has(uniqueKey)) return false;
        seen.add(uniqueKey);
        return true;
      }
      
      // For all others: unique by name + type + location (+ owner if private)
      let uniqueKey = `${name}_${type}_${location}`;
      if (animal.isPrivateOwner) {
        const phone = animal.ownerPhone || '';
        const owner = animal.ownerName?.toLowerCase() || '';
        uniqueKey += `_${phone}_${owner}`;
      }
      
      if (seen.has(uniqueKey)) return false;
      seen.add(uniqueKey);
      return true;
    });
  };

  // Blood type breakdown - count unique animals only
  const dogDonorsAll = donors.filter(d => d.animalType?.toLowerCase() === 'dog' && d.bloodType);
  const catDonorsAll = donors.filter(d => d.animalType?.toLowerCase() === 'cat' && d.bloodType);
  
  const dogDonors = getUniqueAnimals(dogDonorsAll);
  const catDonors = getUniqueAnimals(catDonorsAll);
  
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

  // Export statistics to CSV
  const handleExportStats = async () => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      
      // Build statistics CSV
      let csvContent = '# Dono App Statistics Export\\n';
      csvContent += `Generated: ${now.toLocaleString()}\\n\\n`;
      
      // Summary stats
      csvContent += 'Summary Statistics\\n';
      csvContent += 'Metric,Value\\n';
      csvContent += `Total Donors,${totalDonors}\\n`;
      csvContent += `Successful Donations,${totalDonations}\\n`;
      csvContent += `Ready to Donate (90+ days),${eligibleDonors}\\n`;
      csvContent += `Private Owners,${privateOwners}\\n`;
      csvContent += `Success Rate,${totalDonors > 0 ? Math.round((totalDonations / totalDonors) * 100) : 0}%\\n`;
      csvContent += '\\n';
      
      // Dog blood types
      csvContent += 'Dog Blood Type Distribution\\n';
      csvContent += 'Blood Type,Count,Percentage\\n';
      dogData.forEach(item => {
        const percent = dogDonors.length > 0 ? Math.round((item.value / dogDonors.length) * 100) : 0;
        csvContent += `${item.name},${item.value},${percent}%\\n`;
      });
      csvContent += `Total Dogs,${dogDonors.length},100%\\n`;
      csvContent += '\\n';
      
      // Cat blood types
      csvContent += 'Cat Blood Type Distribution\\n';
      csvContent += 'Blood Type,Count,Percentage\\n';
      catData.forEach(item => {
        const percent = catDonors.length > 0 ? Math.round((item.value / catDonors.length) * 100) : 0;
        csvContent += `${item.name},${item.value},${percent}%\\n`;
      });
      csvContent += `Total Cats,${catDonors.length},100%\\n`;
      
      // Download
      const { Capacitor } = await import('@capacitor/core');
      const BOM = '\\uFEFF';
      const fullContent = BOM + csvContent;
      
      if (Capacitor.isNativePlatform()) {
        // Mobile
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const filename = `donor_statistics_${dateStr}.csv`;
        
        const result = await Filesystem.writeFile({
          path: filename,
          data: btoa(unescape(encodeURIComponent(fullContent))),
          directory: Directory.Cache
        });
        
        await Share.share({
          title: 'Export Statistics',
          text: 'Donor statistics CSV file',
          url: result.uri,
          dialogTitle: 'Save or Share Statistics'
        });
      } else {
        // Web
        const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `donor_statistics_${dateStr}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      toast.success('✅ Statistics exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('❌ Export failed: ' + error.message);
    }
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
            
            {/* View Toggle & Export */}
            <div className="flex gap-2 justify-center mt-3 flex-wrap">
              <button
                onClick={() => setView('overview')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                  view === 'overview' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setView('analytics')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                  view === 'analytics' 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                📈 Advanced Analytics
              </button>
              <button
                onClick={handleExportStats}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
                title="Export statistics summary to CSV"
              >
                � Export
              </button>
            </div>
          </div>

          {/* Overview View */}
          {view === 'overview' && (
            <div>
              {/* Key Statistics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div className={`${colors.bg.gradient} rounded-xl p-4 shadow-lg border ${colors.border.primary}`}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{totalDonors}</div>
                    <div className={`text-sm ${colors.text.secondary} mt-1`}>Total Animals</div>
                  </div>
                </div>
                <div className={`${colors.bg.gradient} rounded-xl p-4 shadow-lg border ${colors.border.primary}`}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{totalDonations}</div>
                    <div className={`text-sm ${colors.text.secondary} mt-1`}>Successful Donations</div>
                  </div>
                </div>
                <div className={`${colors.bg.gradient} rounded-xl p-4 shadow-lg border ${colors.border.primary}`}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{eligibleDonors}</div>
                    <div className={`text-sm ${colors.text.secondary} mt-1`}>Ready to Donate</div>
                  </div>
                </div>
                <div className={`${colors.bg.gradient} rounded-xl p-4 shadow-lg border ${colors.border.primary}`}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{privateOwners}</div>
                    <div className={`text-sm ${colors.text.secondary} mt-1`}>Private Owners</div>
                  </div>
                </div>
              </div>

              {/* Monthly Statistics Table */}
              <div className={`${colors.bg.gradient} rounded-xl sm:rounded-2xl p-2 sm:p-4 mb-8`}>
                <DonorPivotTable donors={donors} onLocationClick={onLocationClick} />
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
          )}

          {/* Advanced Analytics View */}
          {view === 'analytics' && (
            <EnhancedDashboard />
          )}
        </div>
      </div>
    </div>
  );
};

export default DonorDashboard;
