import React, { useState, useRef, useEffect } from 'react';

const MonthlyDataManager = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [dataType, setDataType] = useState('external'); // 'external' or 'sales'
  const [monthlyData, setMonthlyData] = useState({});
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Load existing monthly data on component mount
  useEffect(() => {
    loadMonthlyData();
  }, []);

  // Load all monthly data from localStorage
  const loadMonthlyData = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('monthly_data_')) {
        try {
          const value = JSON.parse(localStorage.getItem(key));
          const [, , monthYear, type] = key.split('_');
          if (!data[monthYear]) data[monthYear] = {};
          data[monthYear][type] = value;
        } catch (e) {
          console.error('Error loading monthly data:', e);
        }
      }
    }
    setMonthlyData(data);
  };

  // Save data to localStorage with month and type
  const saveMonthlyData = (month, type, data) => {
    const key = `monthly_data_${month}_${type}`;
    localStorage.setItem(key, JSON.stringify(data));
    loadMonthlyData(); // Refresh the display
  };

  // Detect data type from JSON structure
  const detectDataType = (jsonData) => {
    if (!Array.isArray(jsonData) || jsonData.length === 0) return null;
    
    const firstItem = jsonData[0];
    
    // External usage: has fields D, G, H and D contains "חיצוני"
    if (firstItem.D && firstItem.G && firstItem.H) {
      if (firstItem.D.includes('חיצוני')) {
        return 'external';
      }
    }
    
    // Sales data: has fields A, B, F
    if (firstItem.A && firstItem.B && firstItem.F) {
      return 'sales';
    }
    
    return null;
  };

  // Process external usage data
  const processExternalData = (jsonData) => {
    const summary = {};
    
    jsonData.forEach(item => {
      if (item.D && item.D.includes('חיצוני')) {
        const type = item.D.trim();
        const quantity = parseInt(item.G) || 0;
        
        if (!summary[type]) {
          summary[type] = {
            type,
            totalQuantity: 0
          };
        }
        summary[type].totalQuantity += quantity;
      }
    });
    
    return {
      rawData: jsonData,
      summary: Object.values(summary),
      totalItems: Object.values(summary).reduce((sum, item) => sum + item.totalQuantity, 0)
    };
  };

  // Process sales data
  const processSalesData = (jsonData) => {
    const summary = {};
    
    jsonData.forEach(item => {
      if (item.A && item.B && item.F) {
        const type = item.A.trim();
        const quantity = parseInt(item.B) || 0;
        const amount = parseFloat(item.F) || 0;
        
        if (!summary[type]) {
          summary[type] = {
            type,
            totalQuantity: 0,
            totalAmount: 0
          };
        }
        summary[type].totalQuantity += quantity;
        summary[type].totalAmount += amount;
      }
    });
    
    return {
      rawData: jsonData,
      summary: Object.values(summary),
      totalQuantity: Object.values(summary).reduce((sum, item) => sum + item.totalQuantity, 0),
      totalAmount: Object.values(summary).reduce((sum, item) => sum + item.totalAmount, 0)
    };
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!selectedMonth) {
      setError('Please select a month first');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        
        if (!Array.isArray(jsonData)) {
          setError('Invalid JSON format - expected an array');
          return;
        }

        const detectedType = detectDataType(jsonData);
        if (!detectedType) {
          setError('Could not detect data type. Please ensure JSON has the correct structure.');
          return;
        }

        let processedData;
        if (detectedType === 'external') {
          processedData = processExternalData(jsonData);
        } else if (detectedType === 'sales') {
          processedData = processSalesData(jsonData);
        }

        // Save the processed data
        saveMonthlyData(selectedMonth, detectedType, processedData);
        
        setError('');
        alert(`✅ ${detectedType === 'external' ? 'External usage' : 'Sales'} data uploaded successfully for ${selectedMonth}!`);
        
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err) {
        setError('Error parsing JSON file: ' + err.message);
      }
    };

    reader.readAsText(file);
  };

  // Generate month options for the past 2 years and next year
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
        const monthLabel = new Date(year, month - 1).toLocaleDateString('en-US', { 
          month: 'long', 
          year: 'numeric' 
        });
        options.push({ value: monthKey, label: monthLabel });
      }
    }
    
    return options.reverse(); // Most recent first
  };

  // Get yearly summary
  const getYearlySummary = () => {
    const yearlySummary = {};
    
    Object.entries(monthlyData).forEach(([month, types]) => {
      const year = month.split('-')[0];
      if (!yearlySummary[year]) {
        yearlySummary[year] = {
          external: { totalItems: 0, typeCount: 0 },
          sales: { totalQuantity: 0, totalAmount: 0, typeCount: 0 }
        };
      }
      
      if (types.external) {
        yearlySummary[year].external.totalItems += types.external.totalItems;
        yearlySummary[year].external.typeCount += types.external.summary.length;
      }
      
      if (types.sales) {
        yearlySummary[year].sales.totalQuantity += types.sales.totalQuantity;
        yearlySummary[year].sales.totalAmount += types.sales.totalAmount;
        yearlySummary[year].sales.typeCount += types.sales.summary.length;
      }
    });
    
    return yearlySummary;
  };

  const monthOptions = generateMonthOptions();
  const yearlySummary = getYearlySummary();

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-6">Monthly Data Management</h2>
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
          <button 
            onClick={() => setError('')}
            className="mt-2 text-sm underline"
          >
            Close
          </button>
        </div>
      )}

      {/* Upload Section */}
      <div className="mb-6 p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
        <h3 className="text-lg font-semibold mb-4 text-blue-800">Upload Monthly Data</h3>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Choose month...</option>
              {monthOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedMonth}
              className={`w-full px-4 py-2 rounded font-bold ${
                selectedMonth 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              📁 Upload JSON File
            </button>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileUpload}
        />
        
        <div className="text-sm text-blue-700">
          <p><strong>Supported formats:</strong></p>
          <p>• External usage: JSON with fields D, G, H (D contains "חיצוני")</p>
          <p>• Sales data: JSON with fields A, B, F</p>
        </div>
      </div>

      {/* Monthly Data Display */}
      <div className="space-y-4">
        {Object.keys(monthlyData).length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg">No monthly data uploaded yet</p>
            <p className="text-sm">Upload JSON files to see monthly summaries</p>
          </div>
        ) : (
          Object.entries(monthlyData)
            .sort(([a], [b]) => b.localeCompare(a)) // Sort by month descending
            .map(([month, types]) => {
              const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              });
              
              return (
                <div key={month} className="border rounded-lg p-4 bg-white shadow">
                  <h3 className="text-lg font-bold mb-3 text-gray-800">{monthLabel}</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* External Usage */}
                    {types.external && (
                      <div className="p-3 bg-green-50 rounded border">
                        <h4 className="font-semibold text-green-800 mb-2">External Usage</h4>
                        <p className="text-sm text-green-700 mb-2">
                          Total Items: <span className="font-bold">{types.external.totalItems}</span>
                        </p>
                        <div className="space-y-1">
                          {types.external.summary.map((item, idx) => (
                            <div key={idx} className="text-xs bg-white p-2 rounded">
                              <div className="font-medium">{item.type}</div>
                              <div className="text-gray-600">Quantity: {item.totalQuantity}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Sales Data */}
                    {types.sales && (
                      <div className="p-3 bg-blue-50 rounded border">
                        <h4 className="font-semibold text-blue-800 mb-2">Sales Data</h4>
                        <p className="text-sm text-blue-700 mb-2">
                          Total Quantity: <span className="font-bold">{types.sales.totalQuantity}</span><br/>
                          Total Amount: <span className="font-bold">{types.sales.totalAmount.toFixed(2)} ₪</span>
                        </p>
                        <div className="space-y-1">
                          {types.sales.summary.map((item, idx) => (
                            <div key={idx} className="text-xs bg-white p-2 rounded">
                              <div className="font-medium">{item.type}</div>
                              <div className="text-gray-600">
                                Qty: {item.totalQuantity}, Amount: {item.totalAmount.toFixed(2)} ₪
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* Yearly Summary */}
      {Object.keys(yearlySummary).length > 0 && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Yearly Summary</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(yearlySummary)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([year, data]) => (
                <div key={year} className="bg-white p-3 rounded border">
                  <h4 className="font-bold text-center mb-3">{year}</h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="p-2 bg-green-50 rounded">
                      <div className="font-medium text-green-800">External Usage</div>
                      <div>Total Items: {data.external.totalItems}</div>
                    </div>
                    
                    <div className="p-2 bg-blue-50 rounded">
                      <div className="font-medium text-blue-800">Sales</div>
                      <div>Quantity: {data.sales.totalQuantity}</div>
                      <div>Amount: {data.sales.totalAmount.toFixed(2)} ₪</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyDataManager;