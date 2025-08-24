import React, { useState, useEffect } from 'react';
import { storage, safeJsonParse } from '../utils/storage.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const ExternalCells = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [monthData, setMonthData] = useState({
    wholeBloodCat: '',
    wholeBloodDog: '',
    plasmaCat: '',
    plasmaDog: '',
    pcCat: '',
    pcDog: ''
  });
  const [allData, setAllData] = useState({});

  // Generate months starting from January 2024
  const generateMonths = () => {
    const months = [];
    const startDate = new Date(2024, 0, 1); // January 2024
    const currentDate = new Date();
    
    // Add future months up to 12 months ahead
    const endDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1);
    
    let current = new Date(startDate);
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;
      const monthName = current.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      months.push({ key: monthKey, name: monthName });
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  const months = generateMonths();

  // Load data from localStorage on component mount
  useEffect(() => {
    const storedData = storage.getString('external_cells_data', null);
    if (storedData) {
      const parsed = safeJsonParse(storedData, {});
      setAllData(parsed);
    }
  }, []);

  // Update month data when selected month changes
  useEffect(() => {
    if (selectedMonth && allData[selectedMonth]) {
      setMonthData(allData[selectedMonth]);
    } else {
      setMonthData({
        wholeBloodCat: '',
        wholeBloodDog: '',
        plasmaCat: '',
        plasmaDog: '',
        pcCat: '',
        pcDog: ''
      });
    }
  }, [selectedMonth, allData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setMonthData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = () => {
    if (!selectedMonth) {
      alert('Please select a month first');
      return;
    }

    const updatedData = {
      ...allData,
      [selectedMonth]: {
        wholeBloodCat: Number(monthData.wholeBloodCat) || 0,
        wholeBloodDog: Number(monthData.wholeBloodDog) || 0,
        plasmaCat: Number(monthData.plasmaCat) || 0,
        plasmaDog: Number(monthData.plasmaDog) || 0,
        pcCat: Number(monthData.pcCat) || 0,
        pcDog: Number(monthData.pcDog) || 0
      }
    };

    setAllData(updatedData);
    storage.setString('external_cells_data', JSON.stringify(updatedData));
    alert('Data saved successfully!');
  };

  // Prepare chart data
  const chartData = months
    .filter(month => allData[month.key])
    .map(month => {
      const data = allData[month.key];
      return {
        month: month.name,
        monthKey: month.key,
        'Whole Blood Cat': data.wholeBloodCat,
        'Whole Blood Dog': data.wholeBloodDog,
        'Plasma Cat': data.plasmaCat,
        'Plasma Dog': data.plasmaDog,
        'PC Cat': data.pcCat,
        'PC Dog': data.pcDog,
        total: data.wholeBloodCat + data.wholeBloodDog + data.plasmaCat + data.plasmaDog + data.pcCat + data.pcDog
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const productTypes = [
    { key: 'wholeBloodCat', label: 'דם מלא- חתול (Whole Blood - Cat)', color: '#ff6b6b', chartKey: 'Whole Blood Cat' },
    { key: 'wholeBloodDog', label: 'דם מלא- כלב (Whole Blood - Dog)', color: '#4ecdc4', chartKey: 'Whole Blood Dog' },
    { key: 'plasmaCat', label: 'פלסמה- חתול (Plasma - Cat)', color: '#45b7d1', chartKey: 'Plasma Cat' },
    { key: 'plasmaDog', label: 'פלסמה- כלב (Plasma - Dog)', color: '#96ceb4', chartKey: 'Plasma Dog' },
    { key: 'pcCat', label: 'תרכיז- חתול (PC - Cat)', color: '#feca57', chartKey: 'PC Cat' },
    { key: 'pcDog', label: 'תרכיז- כלב (PC - Dog)', color: '#ff9ff3', chartKey: 'PC Dog' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-bold text-center mb-6">External Cells Management</h2>
      
      {/* Month Selection */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Month:
        </label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Choose a month...</option>
          {months.map(month => (
            <option key={month.key} value={month.key}>
              {month.name}
            </option>
          ))}
        </select>
      </div>

      {/* Data Entry Form */}
      {selectedMonth && (
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">
            External Sales Data for {months.find(m => m.key === selectedMonth)?.name}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {productTypes.map(product => (
              <div key={product.key} className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  {product.label}
                </label>
                <input
                  type="number"
                  name={product.key}
                  value={monthData[product.key]}
                  onChange={handleInputChange}
                  min="0"
                  className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter quantity..."
                />
              </div>
            ))}
          </div>
          
          <button
            onClick={handleSave}
            className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Save Data
          </button>
        </div>
      )}

      {/* Summary Charts */}
      {chartData.length > 0 && (
        <div className="space-y-6">
          {/* Trend Chart */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">Monthly Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <XAxis 
                  dataKey="month" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={10}
                />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                {productTypes.map(product => (
                  <Line
                    key={product.key}
                    type="monotone"
                    dataKey={product.chartKey}
                    stroke={product.color}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">Monthly Comparison</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <XAxis 
                  dataKey="month" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={10}
                />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                {productTypes.map(product => (
                  <Bar
                    key={product.key}
                    dataKey={product.chartKey}
                    fill={product.color}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Table */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">Data Summary</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    {productTypes.map(product => (
                      <th key={product.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {product.label.split(' (')[0]}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {chartData.map(row => (
                    <tr key={row.monthKey}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.month}
                      </td>
                      {productTypes.map(product => (
                        <td key={product.key} className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {allData[row.monthKey][product.key]}
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No data available yet. Select a month and enter some data to see charts and summary.</p>
        </div>
      )}
    </div>
  );
};

export default ExternalCells;
