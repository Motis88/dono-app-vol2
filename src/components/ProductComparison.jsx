import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const ProductComparison = ({ sells, setSells, externalUsageCount, setExternalUsageCount }) => {
  const [error, setError] = useState('');
  const [salesData, setSalesData] = useState([]);
  const [usageData, setUsageData] = useState([]);
  const usageFileInputRef = useRef(null);
  const salesFileInputRef = useRef(null);

  // Function to find the actual header row by scanning first 10-15 rows
  const findHeaderRow = (data, expectedHeaders) => {
    // Scan first 15 rows (or all rows if less than 15)
    const scanRows = Math.min(15, data.length);
    
    for (let i = 0; i < scanRows; i++) {
      const row = data[i];
      const rowKeys = Object.keys(row).map(key => key.toLowerCase());
      
      // Check if this row contains expected headers
      const matchCount = expectedHeaders.filter(header => 
        rowKeys.some(key => key.includes(header.toLowerCase()))
      ).length;
      
      // If we find at least half of the expected headers, consider this the header row
      if (matchCount >= Math.ceil(expectedHeaders.length / 2)) {
        return i;
      }
    }
    
    // Default to first row if no clear header row found
    return 0;
  };

  // Function to handle Usage file upload
  const handleUsageFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError('');
    
    try {
      const result = await parseFile(file);
      
      // Find the actual header row for usage files
      const expectedUsageHeaders = ['Medicine', 'Quantity', 'מקור', 'שם', 'כמות'];
      const headerRowIndex = findHeaderRow(result, expectedUsageHeaders);
      
      // Process data starting from the row after the header
      const dataRows = result.slice(headerRowIndex);
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Process each row for usage data
      const processedData = dataRows.map(row => {
        // Map Usage file headers to our format
        const medicineValue = findColumnValue(row, ['Medicine', 'medicine', 'מוצר', 'תרופה', 'שם']);
        const quantityValue = findColumnValue(row, ['Quantity (units)', 'Quantity', 'quantity', 'כמות', 'כמות (יחידות)']);
        const sourceValue = findColumnValue(row, ['מקור', 'Source', 'source']) || '';
        
        return {
          id: Date.now() + Math.random(),
          productName: medicineValue || 'Unknown',
          quantity: Number(quantityValue) || 0, // Convert to Number
          source: sourceValue,
          date: currentDate,
          type: 'usage'
        };
      }).filter(item => item.productName !== 'Unknown' && item.quantity > 0);

      // Update usage data state
      setUsageData(prev => [...prev, ...processedData]);
      
      // Also update the old sells state for backward compatibility
      setSells(prev => [...prev, ...processedData.map(item => ({
        ...item,
        price: 0,
        total: 0
      }))]);
      
      // Calculate external usage count from usage data only
      const newUsageData = [...usageData, ...processedData];
      const externalCount = newUsageData.filter(item => item.source === 'חיצוני').length;
      setExternalUsageCount(externalCount);
      
      alert(`✅ Usage file processed successfully! Added ${processedData.length} records.`);
    } catch (error) {
      setError(`Error processing usage file: ${error.message}`);
    }

    // Clear file input
    if (usageFileInputRef.current) {
      usageFileInputRef.current.value = '';
    }
  };

  // Function to handle Sales file upload
  const handleSalesFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError('');
    
    try {
      const result = await parseFile(file);
      
      // Find the actual header row for sales files
      const expectedSalesHeaders = ['Name', 'Quantity', 'Total'];
      const headerRowIndex = findHeaderRow(result, expectedSalesHeaders);
      
      // Process data starting from the row after the header
      const dataRows = result.slice(headerRowIndex);
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Process each row for sales data
      const processedData = dataRows.map(row => {
        // Map Sales file headers to our format according to requirements:
        // Name -> productName, Quantity -> quantity, Total incl. VAT -> price
        const nameValue = findColumnValue(row, ['Name', 'name', 'שם', 'מוצר']);
        const quantityValue = findColumnValue(row, ['Quantity', 'quantity', 'כמות']);
        const priceValue = findColumnValue(row, ['Total incl. VAT', 'Total', 'total', 'סה״כ', 'סה״כ כולל מע״מ']);
        
        const quantity = Number(quantityValue) || 0; // Convert to Number
        const price = Number(priceValue) || 0; // Convert to Number
        const total = quantity * price; // Calculate total from quantity * price
        
        return {
          id: Date.now() + Math.random(),
          productName: nameValue || 'Unknown',
          quantity: quantity,
          price: price,
          date: currentDate,
          total: total,
          type: 'sales'
        };
      }).filter(item => item.productName !== 'Unknown' && item.quantity > 0);

      // Update sales data state
      setSalesData(prev => [...prev, ...processedData]);
      
      // Also update the old sells state for backward compatibility
      setSells(prev => [...prev, ...processedData.map(item => ({
        ...item,
        source: ''
      }))]);
      
      alert(`✅ Sales file processed successfully! Added ${processedData.length} records.`);
    } catch (error) {
      setError(`Error processing sales file: ${error.message}`);
    }

    // Clear file input
    if (salesFileInputRef.current) {
      salesFileInputRef.current.value = '';
    }
  };

  // Helper function to find column value by multiple possible names
  const findColumnValue = (row, possibleNames) => {
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        return row[name];
      }
    }
    return null;
  };

  // Function to parse file based on extension
  const parseFile = async (file) => {
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          let data = null;
          
          if (fileExtension === 'csv') {
            const parsed = Papa.parse(e.target.result, { 
              header: true, 
              skipEmptyLines: true 
            });
            if (parsed.errors.length > 0) {
              throw new Error(`CSV parsing error: ${parsed.errors[0].message}`);
            }
            data = parsed.data;
          } else if (['xlsx', 'xls'].includes(fileExtension)) {
            const workbook = XLSX.read(e.target.result, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            data = XLSX.utils.sheet_to_json(sheet);
          } else {
            throw new Error(`Unsupported file type: ${fileExtension}`);
          }

          resolve(data);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('File reading failed'));

      if (['xlsx', 'xls'].includes(fileExtension)) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  // Calculate sales summary by product from salesData only
  const getSalesSummary = () => {
    const productGroups = {};
    
    salesData.forEach(item => {
      if (!productGroups[item.productName]) {
        productGroups[item.productName] = {
          productName: item.productName,
          totalQuantity: 0,
          totalRevenue: 0
        };
      }
      productGroups[item.productName].totalQuantity += item.quantity;
      productGroups[item.productName].totalRevenue += item.total;
    });
    
    const productSummaries = Object.values(productGroups);
    const grandTotalRevenue = productSummaries.reduce((sum, product) => sum + product.totalRevenue, 0);
    
    return {
      productSummaries,
      grandTotalRevenue,
      hasSalesData: salesData.length > 0
    };
  };

  // Calculate usage summary by product from usageData only
  const getUsageSummary = () => {
    const productGroups = {};
    
    usageData.forEach(item => {
      if (!productGroups[item.productName]) {
        productGroups[item.productName] = {
          productName: item.productName,
          totalQuantity: 0
        };
      }
      productGroups[item.productName].totalQuantity += item.quantity;
    });
    
    const productSummaries = Object.values(productGroups);
    
    return {
      productSummaries,
      hasUsageData: usageData.length > 0
    };
  };

  const salesSummary = getSalesSummary();
  const usageSummary = getUsageSummary();

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-4">Summary Dashboard</h2>
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
          <button 
            onClick={() => setError('')}
            className="mt-2 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* File Upload Section */}
      <div className="mb-6 space-y-4">
        <h3 className="text-lg font-semibold">File Upload</h3>
        
        {/* Usage File Upload */}
        <div className="p-4 border-2 border-dashed border-green-300 rounded-lg bg-green-50">
          <div className="text-center">
            <button
              onClick={() => usageFileInputRef.current?.click()}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 mb-2"
            >
              📋 העלאת קובץ שימוש
            </button>
            <input
              ref={usageFileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleUsageFileUpload}
            />
            <p className="text-sm text-green-700">
              Usage files: Expected columns - Medicine/שם, Quantity/כמות, מקור (Source)
            </p>
            {externalUsageCount > 0 && (
              <div className="mt-2 p-2 bg-green-100 rounded">
                <span className="text-green-800 font-semibold">
                  כמות שימוש חיצוני: {externalUsageCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sales File Upload */}
        <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
          <div className="text-center">
            <button
              onClick={() => salesFileInputRef.current?.click()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mb-2"
            >
              💰 העלאת קובץ מכירות
            </button>
            <input
              ref={salesFileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleSalesFileUpload}
            />
            <p className="text-sm text-blue-700">
              Sales files: Expected columns - Name/שם, Quantity/כמות, Total incl. VAT
            </p>
          </div>
        </div>
      </div>

      {/* Sales Summary Dashboard */}
      {salesSummary.hasSalesData && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h4 className="text-lg font-semibold mb-3 text-blue-800">סיכום מכירות</h4>
          
          {/* Sales Summary Table */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full bg-white rounded border">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-4 py-2 text-right border-b">מוצר</th>
                  <th className="px-4 py-2 text-center border-b">כמות שנמכרה</th>
                  <th className="px-4 py-2 text-center border-b">סה״כ הכנסה</th>
                </tr>
              </thead>
              <tbody>
                {salesSummary.productSummaries.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b text-right">{product.productName}</td>
                    <td className="px-4 py-2 border-b text-center">{product.totalQuantity}</td>
                    <td className="px-4 py-2 border-b text-center">{product.totalRevenue.toFixed(2)} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Grand Total */}
          <div className="text-center p-3 bg-blue-100 rounded border">
            <span className="text-lg font-bold text-blue-800">
              סה״כ הכנסה כללי: {salesSummary.grandTotalRevenue.toFixed(2)} ₪
            </span>
          </div>
        </div>
      )}

      {/* Usage Summary Dashboard */}
      {usageSummary.hasUsageData && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
          <h4 className="text-lg font-semibold mb-3 text-green-800">סיכום שימוש</h4>
          
          {/* Usage Summary Table */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full bg-white rounded border">
              <thead className="bg-green-100">
                <tr>
                  <th className="px-4 py-2 text-right border-b">מוצר</th>
                  <th className="px-4 py-2 text-center border-b">כמות שימוש</th>
                </tr>
              </thead>
              <tbody>
                {usageSummary.productSummaries.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b text-right">{product.productName}</td>
                    <td className="px-4 py-2 border-b text-center">{product.totalQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!salesSummary.hasSalesData && !usageSummary.hasUsageData && (
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg">No data uploaded yet</p>
          <p className="text-sm">Upload sales or usage files to see summaries</p>
        </div>
      )}
    </div>
  );
};

export default ProductComparison;