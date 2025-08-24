import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const EconomicsTab = () => {
  const [error, setError] = useState('');
  const [usageData, setUsageData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [usageMonth, setUsageMonth] = useState('');
  const [salesMonth, setSalesMonth] = useState('');
  
  const usageFileInputRef = useRef(null);
  const salesFileInputRef = useRef(null);

  // Extract month and year from filename pattern
  const extractMonthFromFilename = (filename) => {
    // Pattern: Medicine_usage_01-07-2025_-_31-07-2025 or Item_sales_01-05-2025_-_31-05-2025
    const datePattern = /(\d{2})-(\d{2})-(\d{4})/;
    const match = filename.match(datePattern);
    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3];
      return `${month}/${year}`;
    }
    return '';
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

  // Helper function to find column value by multiple possible names
  const findColumnValue = (row, possibleNames) => {
    for (const name of possibleNames) {
      const keys = Object.keys(row);
      const matchedKey = keys.find(key => 
        possibleNames.some(pName => 
          key.toLowerCase().includes(pName.toLowerCase()) || 
          pName.toLowerCase().includes(key.toLowerCase())
        )
      );
      if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && row[matchedKey] !== '') {
        return row[matchedKey];
      }
    }
    return null;
  };

  // Handle Medicine Usage file upload
  const handleUsageFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError('');
    
    try {
      const result = await parseFile(file);
      const monthYear = extractMonthFromFilename(file.name);
      setUsageMonth(monthYear);
      
      // Process medicine usage data - filter for products containing "חיצונ"
      const processedData = result
        .map(row => {
          const productName = findColumnValue(row, [
            'Medicine', 'medicine', 'מוצר', 'תרופה', 'שם', 'שם מוצר', 'Product Name'
          ]);
          const quantity = findColumnValue(row, [
            'Quantity', 'quantity', 'כמות', 'כמות (יחידות)', 'Amount'
          ]);
          const productType = findColumnValue(row, [
            'Type', 'type', 'סוג', 'סוג מנה', 'Product Type'
          ]);

          return {
            id: Date.now() + Math.random(),
            productName: productName || '',
            productType: productType || '',
            quantity: Number(quantity) || 0,
            monthYear: monthYear
          };
        })
        .filter(item => 
          item.productName && 
          item.productName.includes('חיצונ') && 
          item.quantity > 0
        );

      setUsageData(processedData);
      alert(`✅ קובץ שימוש עובד בהצלחה! נוספו ${processedData.length} רשומות.`);
    } catch (error) {
      setError(`שגיאה בעיבוד קובץ שימוש: ${error.message}`);
    }

    // Clear file input
    if (usageFileInputRef.current) {
      usageFileInputRef.current.value = '';
    }
  };

  // Handle Item Sales file upload
  const handleSalesFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError('');
    
    try {
      const result = await parseFile(file);
      const monthYear = extractMonthFromFilename(file.name);
      setSalesMonth(monthYear);
      
      // Process sales data
      const processedData = result
        .map(row => {
          const productName = findColumnValue(row, [
            'Name', 'name', 'שם', 'מוצר', 'שם מוצר', 'Product Name'
          ]);
          const quantity = findColumnValue(row, [
            'Quantity', 'quantity', 'כמות', 'כמות שנמכרה'
          ]);
          const totalPrice = findColumnValue(row, [
            'Total', 'total', 'סה״כ', 'סכום כללי', 'Total incl. VAT', 'Price'
          ]);

          const parsedQuantity = Number(quantity) || 0;
          const parsedTotal = Number(totalPrice) || 0;

          return {
            id: Date.now() + Math.random(),
            productName: productName || '',
            quantity: parsedQuantity,
            totalAmount: parsedTotal,
            monthYear: monthYear
          };
        })
        .filter(item => 
          item.productName && 
          item.quantity > 0
        );

      setSalesData(processedData);
      alert(`✅ קובץ מכירות עובד בהצלחה! נוספו ${processedData.length} רשומות.`);
    } catch (error) {
      setError(`שגיאה בעיבוד קובץ מכירות: ${error.message}`);
    }

    // Clear file input
    if (salesFileInputRef.current) {
      salesFileInputRef.current.value = '';
    }
  };

  // Calculate usage summary grouped by product type
  const getUsageSummary = () => {
    const productGroups = {};
    
    usageData.forEach(item => {
      const key = item.productType || item.productName;
      if (!productGroups[key]) {
        productGroups[key] = {
          productType: key,
          totalQuantity: 0
        };
      }
      productGroups[key].totalQuantity += item.quantity;
    });
    
    return Object.values(productGroups);
  };

  // Calculate sales summary grouped by product type
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
      productGroups[item.productName].totalRevenue += item.totalAmount;
    });
    
    const productSummaries = Object.values(productGroups);
    const grandTotal = productSummaries.reduce((sum, product) => sum + product.totalRevenue, 0);
    
    return { productSummaries, grandTotal };
  };

  const usageSummary = getUsageSummary();
  const salesSummary = getSalesSummary();

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-4">Economics</h2>
      
      {/* Display current months */}
      <div className="text-center mb-6">
        {usageMonth && (
          <div className="inline-block mx-2 p-2 bg-green-100 rounded">
            <span className="text-green-800 font-semibold">חודש שימוש: {usageMonth}</span>
          </div>
        )}
        {salesMonth && (
          <div className="inline-block mx-2 p-2 bg-blue-100 rounded">
            <span className="text-blue-800 font-semibold">חודש מכירות: {salesMonth}</span>
          </div>
        )}
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p className="font-bold">שגיאה:</p>
          <p>{error}</p>
          <button 
            onClick={() => setError('')}
            className="mt-2 text-sm underline"
          >
            סגור
          </button>
        </div>
      )}

      {/* File Upload Section */}
      <div className="mb-6 grid md:grid-cols-2 gap-4">
        {/* Medicine Usage File Upload */}
        <div className="p-4 border-2 border-dashed border-green-300 rounded-lg bg-green-50">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2 text-green-800">שימוש תרופות</h3>
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
              קבצי שימוש: Medicine_usage_DD-MM-YYYY_-_DD-MM-YYYY
            </p>
          </div>
        </div>

        {/* Item Sales File Upload */}
        <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2 text-blue-800">מכירות פריטים</h3>
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
              קבצי מכירות: Item_sales_DD-MM-YYYY_-_DD-MM-YYYY
            </p>
          </div>
        </div>
      </div>

      {/* Medicine Usage Summary - Only "חיצונ" products */}
      {usageData.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
          <h4 className="text-lg font-semibold mb-3 text-green-800">שימוש תרופות (מוצרי "חיצונ" בלבד)</h4>
          
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded border">
              <thead className="bg-green-100">
                <tr>
                  <th className="px-4 py-2 text-right border-b">מוצר</th>
                  <th className="px-4 py-2 text-center border-b">סוג מנה</th>
                  <th className="px-4 py-2 text-center border-b">כמות</th>
                </tr>
              </thead>
              <tbody>
                {usageSummary.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b text-right">{product.productType}</td>
                    <td className="px-4 py-2 border-b text-center">-</td>
                    <td className="px-4 py-2 border-b text-center font-bold">{product.totalQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item Sales Summary */}
      {salesData.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h4 className="text-lg font-semibold mb-3 text-blue-800">מכירות פריטים</h4>
          
          <div className="overflow-x-auto mb-4">
            <table className="w-full bg-white rounded border">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-4 py-2 text-right border-b">מוצר</th>
                  <th className="px-4 py-2 text-center border-b">כמות שנמכרה</th>
                  <th className="px-4 py-2 text-center border-b">סכום חודשי</th>
                  <th className="px-4 py-2 text-center border-b">סכום כללי</th>
                </tr>
              </thead>
              <tbody>
                {salesSummary.productSummaries.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b text-right">{product.productName}</td>
                    <td className="px-4 py-2 border-b text-center">{product.totalQuantity}</td>
                    <td className="px-4 py-2 border-b text-center">{product.totalRevenue.toFixed(2)} ₪</td>
                    <td className="px-4 py-2 border-b text-center">{product.totalRevenue.toFixed(2)} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Monthly Total */}
          <div className="text-center p-3 bg-blue-100 rounded border">
            <span className="text-lg font-bold text-blue-800">
              סה״כ מכירות חודשיות: {salesSummary.grandTotal.toFixed(2)} ₪
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {usageData.length === 0 && salesData.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg">אין נתונים שהועלו עדיין</p>
          <p className="text-sm">העלה קבצי שימוש או מכירות לראות סיכומים</p>
        </div>
      )}
    </div>
  );
};

export default EconomicsTab;