import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const ProductComparison = ({ sells, setSells, externalUsageCount, setExternalUsageCount }) => {
  const [error, setError] = useState('');
  const usageFileInputRef = useRef(null);
  const salesFileInputRef = useRef(null);

  // Function to handle Usage file upload
  const handleUsageFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError('');
    
    try {
      const result = await parseFile(file);
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Process each row for usage data
      const processedData = result.map(row => {
        // Map Usage file headers to our format
        const medicineValue = findColumnValue(row, ['Medicine', 'medicine', 'מוצר', 'תרופה']);
        const quantityValue = findColumnValue(row, ['Quantity (units)', 'Quantity', 'quantity', 'כמות', 'כמות (יחידות)']);
        const sourceValue = findColumnValue(row, ['מקור', 'Source', 'source']) || '';
        
        return {
          id: Date.now() + Math.random(),
          productName: medicineValue || 'Unknown',
          quantity: parseFloat(quantityValue) || 0,
          price: 0, // Hardcoded to 0 for usage files
          date: currentDate,
          total: 0, // price * quantity = 0
          source: sourceValue,
          type: 'usage'
        };
      }).filter(item => item.productName !== 'Unknown' && item.quantity > 0);

      // Add to sells state
      setSells(prev => [...prev, ...processedData]);
      
      // Calculate external usage count
      const newSells = [...sells, ...processedData];
      const externalCount = newSells.filter(item => item.type === 'usage' && item.source === 'חיצוני').length;
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
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Process each row for sales data
      const processedData = result.map(row => {
        // Map Sales file headers to our format according to requirements:
        // Name -> productName, Quantity -> quantity, Total incl. VAT -> price
        const nameValue = findColumnValue(row, ['Name', 'name', 'שם', 'מוצר']);
        const quantityValue = findColumnValue(row, ['Quantity', 'quantity', 'כמות']);
        const priceValue = findColumnValue(row, ['Total incl. VAT', 'Total', 'total', 'סה״כ', 'סה״כ כולל מע״מ']);
        
        const quantity = parseFloat(quantityValue) || 0;
        const price = parseFloat(priceValue) || 0;
        const total = quantity * price; // Calculate total from quantity * price
        
        return {
          id: Date.now() + Math.random(),
          productName: nameValue || 'Unknown',
          quantity: quantity,
          price: price,
          date: currentDate,
          total: total,
          source: '',
          type: 'sales'
        };
      }).filter(item => item.productName !== 'Unknown' && item.quantity > 0);

      // Add to sells state
      setSells(prev => [...prev, ...processedData]);
      
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

  // Calculate summary statistics
  const getSummary = () => {
    const totalRecords = sells.length;
    const usageRecords = sells.filter(item => item.type === 'usage').length;
    const salesRecords = sells.filter(item => item.type === 'sales').length;
    const totalRevenue = sells.reduce((sum, item) => sum + item.total, 0);
    const totalQuantity = sells.reduce((sum, item) => sum + item.quantity, 0);
    
    return {
      totalRecords,
      usageRecords,
      salesRecords,
      totalRevenue,
      totalQuantity
    };
  };

  // Calculate sales summary by product
  const getSalesSummary = () => {
    const salesData = sells.filter(item => item.type === 'sales');
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

  const summary = getSummary();
  const salesSummary = getSalesSummary();

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-4">Sells 3.0 - Data Management</h2>
      
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
              Usage files: Expected columns - Medicine, Quantity (units), מקור (Source)
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
              Sales files: Expected columns - Name, Quantity, Total incl. VAT
            </p>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {sells.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-2">Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <div className="font-bold text-lg">{summary.totalRecords}</div>
              <div className="text-gray-600">Total Records</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-green-600">{summary.usageRecords}</div>
              <div className="text-gray-600">Usage Records</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-blue-600">{summary.salesRecords}</div>
              <div className="text-gray-600">Sales Records</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">{summary.totalQuantity}</div>
              <div className="text-gray-600">Total Quantity</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">{summary.totalRevenue.toFixed(2)}</div>
              <div className="text-gray-600">Total Revenue</div>
            </div>
          </div>
        </div>
      )}

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

      {/* Data Table */}
      {sells.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left border-b">Date</th>
                <th className="px-4 py-2 text-left border-b">Product Name</th>
                <th className="px-4 py-2 text-right border-b">Quantity</th>
                <th className="px-4 py-2 text-right border-b">Price</th>
                <th className="px-4 py-2 text-right border-b">Total</th>
                <th className="px-4 py-2 text-center border-b">Source</th>
              </tr>
            </thead>
            <tbody>
              {sells.map((row, index) => (
                <tr key={row.id || index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b">{row.date}</td>
                  <td className="px-4 py-2 border-b">{row.productName}</td>
                  <td className="px-4 py-2 border-b text-right">{row.quantity}</td>
                  <td className="px-4 py-2 border-b text-right">{row.price.toFixed(2)}</td>
                  <td className="px-4 py-2 border-b text-right">{row.total.toFixed(2)}</td>
                  <td className="px-4 py-2 border-b text-center">
                    <span className={`px-2 py-1 text-xs rounded ${
                      row.type === 'usage' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg">No data uploaded yet</p>
          <p className="text-sm">Upload usage or sales files to see data in the table</p>
        </div>
      )}
    </div>
  );
};

export default ProductComparison;