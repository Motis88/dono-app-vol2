import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { donorStorage } from '../utils/storage.js';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { 
  getDonationTrends, 
  getDonorRetention
} from '../utils/analyticsUtils.js';

const EnhancedDashboard = () => {
  const { colors, isDarkMode } = useTheme();
  const donors = donorStorage.getDonors();

  // Enhanced analytics data
  const trends = getDonationTrends(donors, 6);
  const retention = getDonorRetention(donors);

  return (
    <div className="space-y-6">
      {/* Trends Chart */}
      <div className={`${colors.bg.card} rounded-xl shadow-lg p-6 border ${colors.border.primary}`}>
        <h2 className={`text-xl font-bold mb-4 ${colors.text.primary}`}>📈 6-Month Donation Trends</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
            <XAxis 
              dataKey="month" 
              stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
            <Tooltip 
              contentStyle={{
                backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="donated" stroke="#10b981" name="Donated" strokeWidth={2} />
            <Line type="monotone" dataKey="notDonated" stroke="#ef4444" name="Not Donated" strokeWidth={2} />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {trends.slice(-3).map((month) => (
            <div key={month.monthKey} className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 rounded-lg p-3">
              <div className="text-xs text-gray-600 dark:text-gray-300">{month.month}</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{month.successRate}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
            </div>
          ))}
        </div>
      </div>

      {/* Retention Stats */}
      <div className={`${colors.bg.card} rounded-xl shadow-lg p-6 border ${colors.border.primary}`}>
        <h2 className={`text-xl font-bold mb-4 ${colors.text.primary}`}>🔄 Donor Retention</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">{retention.totalAnimals}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Total Animals</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-300">{retention.repeatDonors}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Repeat Donors</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">{retention.retentionRate}%</div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Retention Rate</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-300">{retention.onTimeRepeatDonors}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">On-Time Repeats</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDashboard;
