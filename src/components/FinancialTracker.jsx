import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';

// Blood product definitions - matching the CSV reports
const BLOOD_PRODUCTS = {
  'מנת דם טרי כלב': { code: 'FRESH BLOOD', type: 'fresh', species: 'dog', name_he: 'דם טרי כלב', name_en: 'Fresh Whole Blood Dog' },
  'מנת דם מלא- חתול  mdm cat': { code: 'WHOLE BLOOD CAT', type: 'whole', species: 'cat', name_he: 'דם מלא חתול', name_en: 'Whole Blood Cat' },
  'מנת דם מלא- כלב n mdm dog': { code: 'WHOLE BLOOD DOG', type: 'whole', species: 'dog', name_he: 'דם מלא כלב', name_en: 'Whole Blood Dog' },
  'מנת דם פלסמה חתול  mdp cat': { code: 'PLASMA CAT', type: 'plasma', species: 'cat', name_he: 'פלסמה חתול', name_en: 'Plasma Cat' },
  'מנת דם פלסמה כלב  mdp dog': { code: 'PLASMA DOG', type: 'plasma', species: 'dog', name_he: 'פלסמה כלב', name_en: 'Plasma Dog' },
  'מנת דם תרכיז תאים כלב  mdtt dog': { code: 'PC DOG', type: 'prbc', species: 'dog', name_he: 'תרכיז תאים כלב', name_en: 'Packed Cells Dog' },
  'מנת דם תרכיז תאים-גדול-חתול  mdttbig cat': { code: 'PC CAT', type: 'prbc_large', species: 'cat', name_he: 'תרכיז תאים גדול חתול', name_en: 'Packed Cells Cat' },
};

const FINANCIAL_STORAGE_KEY = 'financial_data';

const FinancialTracker = () => {
  const { colors } = useTheme();
  const [financialData, setFinancialData] = useState({});
  const [monthlySales, setMonthlySales] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState({});

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = () => {
    const saved = localStorage.getItem(FINANCIAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFinancialData(parsed.summary || {});
        setMonthlySales(parsed.sales || []);
      } catch (e) {
        console.error('Error loading financial data:', e);
      }
    }
  };

  const saveFinancialData = (summary, sales) => {
    localStorage.setItem(FINANCIAL_STORAGE_KEY, JSON.stringify({
      summary: summary,
      sales: sales,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const importSalesCSV = async (file) => {
    setImporting(true);
    try {
      const text = await file.text();
      
      Papa.parse(text, {
        complete: (results) => {
          const data = results.data;
          let totalImported = 0;
          const salesByProduct = {};
          
          // Parse CSV rows - Item_sales format
          data.forEach((row, index) => {
            if (index < 2 || !row[1]) return; // Skip headers
            
            const productName = row[1]?.trim();
            const quantity = parseFloat(row[3]?.replace(',', '.') || '0');
            const revenueExcl = parseFloat(row[5]?.replace(',', '.') || '0');
            const revenueIncl = parseFloat(row[6]?.replace(',', '.') || '0');
            
            // Match product
            let matchedProduct = null;
            if (BLOOD_PRODUCTS[productName]) {
              matchedProduct = productName;
            } else {
              Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
                if (productName.includes(productKey.split(' -')[0])) {
                  matchedProduct = productKey;
                }
              });
            }
            
            if (matchedProduct && quantity > 0) {
              if (!salesByProduct[matchedProduct]) {
                salesByProduct[matchedProduct] = { quantity: 0, revenueExcl: 0, revenueIncl: 0 };
              }
              salesByProduct[matchedProduct].quantity += quantity;
              salesByProduct[matchedProduct].revenueExcl += revenueExcl;
              salesByProduct[matchedProduct].revenueIncl += revenueIncl;
              totalImported++;
            }
          });
          
          // Update financial data
          const updatedData = { ...financialData };
          Object.keys(salesByProduct).forEach(productKey => {
            if (!updatedData[productKey]) {
              updatedData[productKey] = { quantity: 0, revenueExcl: 0, revenueIncl: 0 };
            }
            updatedData[productKey].quantity += salesByProduct[productKey].quantity;
            updatedData[productKey].revenueExcl += salesByProduct[productKey].revenueExcl;
            updatedData[productKey].revenueIncl += salesByProduct[productKey].revenueIncl;
          });
          
          const newSale = {
            date: new Date().toISOString(),
            fileName: file.name,
            products: salesByProduct,
          };
          
          const updatedHistory = [...monthlySales, newSale];
          
          setFinancialData(updatedData);
          setMonthlySales(updatedHistory);
          saveFinancialData(updatedData, updatedHistory);
          
          setImporting(false);
          setShowImport(false);
          
          alert(`✅ Import Successful!\n\nImported ${totalImported} sales records\nUpdated ${Object.keys(salesByProduct).length} products`);
        },
      });
    } catch (error) {
      console.error('Import error:', error);
      setImporting(false);
      alert('❌ Import failed. Please check your file format.');
    }
  };

  const deleteImportHistory = (index) => {
    if (!window.confirm('🗑️ Delete this month\'s data?')) return;
    
    try {
      const deletedSale = monthlySales[index];
      const updatedSummary = { ...financialData };
      
      // Subtract the deleted sale from the summary
      Object.keys(deletedSale.products).forEach(productKey => {
        if (updatedSummary[productKey]) {
          updatedSummary[productKey].quantity -= deletedSale.products[productKey].quantity;
          updatedSummary[productKey].revenueExcl -= deletedSale.products[productKey].revenueExcl;
          updatedSummary[productKey].revenueIncl -= deletedSale.products[productKey].revenueIncl;
          
          // Remove if zero
          if (updatedSummary[productKey].quantity <= 0) {
            delete updatedSummary[productKey];
          }
        }
      });
      
      const updatedHistory = monthlySales.filter((_, i) => i !== index);
      
      setFinancialData(updatedSummary);
      setMonthlySales(updatedHistory);
      saveFinancialData(updatedSummary, updatedHistory);
      
      alert('✅ Deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      alert('❌ Delete failed');
    }
  };

  const resetAllData = () => {
    if (!window.confirm('⚠️ Reset ALL financial data? This cannot be undone!')) return;
    setFinancialData({});
    setMonthlySales([]);
    localStorage.removeItem(FINANCIAL_STORAGE_KEY);
    alert('✅ All financial data has been reset');
  };

  const toggleMonth = (index) => {
    setExpandedMonths(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const totalRevenue = Object.values(financialData).reduce((sum, p) => sum + (p?.revenueIncl || 0), 0);
  const totalUnits = Object.values(financialData).reduce((sum, p) => sum + (p?.quantity || 0), 0);

  return (
    <div className="w-full mx-auto p-2 md:p-4 space-y-6">
      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
          <div className={`${colors.bg.card} rounded-2xl p-6 max-w-md w-full`} onClick={e => e.stopPropagation()}>
            <h3 className={`text-2xl font-bold mb-4 ${colors.text.primary}`}>Import Sales CSV</h3>
            <input 
              type="file" 
              accept=".csv"
              onChange={(e) => {
                if (e.target.files[0]) {
                  importSalesCSV(e.target.files[0]);
                }
              }}
              className={`w-full px-4 py-3 rounded-xl border-2 ${colors.border.input} ${colors.bg.input} ${colors.text.primary}`}
              disabled={importing}
            />
            {importing && <p className={`mt-4 text-center ${colors.text.secondary}`}>Importing...</p>}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className={`text-3xl md:text-4xl font-extrabold ${colors.text.primary} mb-2`}>💰 Financial Tracker</h2>
          <div className="flex gap-4 text-sm">
            <div className={`${colors.text.secondary}`}>
              <span className="font-semibold">Total Revenue:</span> ₪{(totalRevenue/1000).toFixed(1)}k
            </div>
            <div className={`${colors.text.secondary}`}>
              <span className="font-semibold">Total Units:</span> {totalUnits.toFixed(1)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
          >
            <span className="text-xl">📥</span>
            <span className="text-sm">Import</span>
          </button>
          <button
            onClick={resetAllData}
            className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-3 rounded-xl font-bold hover:from-red-600 hover:to-rose-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
          >
            <span className="text-xl">🗑️</span>
            <span className="text-sm">Reset</span>
          </button>
        </div>
      </div>

      {/* Monthly Comparison Table with Trends */}
      {monthlySales.length > 1 && (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-lg p-4 md:p-6">
          <h3 className="text-xl md:text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200 flex items-center gap-2">
            � Monthly Comparison & Trends
          </h3>
          
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl p-4 border-2 border-blue-200 dark:border-blue-700 shadow-md text-center">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1 text-center">Total Revenue</div>
              <div className="text-2xl md:text-3xl font-extrabold text-blue-700 dark:text-blue-300 text-center">
                ₪{(totalRevenue / 1000).toFixed(1)}k
              </div>
              <div className="text-xs text-blue-500 dark:text-blue-400 mt-1 text-center">
                Avg: ₪{(totalRevenue / monthlySales.length / 1000).toFixed(1)}k/mo
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl p-4 border-2 border-purple-200 dark:border-purple-700 shadow-md text-center">
              <div className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1 text-center">Total Units</div>
              <div className="text-2xl md:text-3xl font-extrabold text-purple-700 dark:text-purple-300 text-center">
                {totalUnits.toFixed(0)}
              </div>
              <div className="text-xs text-purple-500 dark:text-purple-400 mt-1 text-center">
                Avg: {(totalUnits / monthlySales.length).toFixed(0)}/mo
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-700 shadow-md text-center">
              <div className="text-xs text-green-600 dark:text-green-400 font-bold mb-1 text-center">Best Month</div>
              <div className="text-2xl md:text-3xl font-extrabold text-green-700 dark:text-green-300 text-center">
                ₪{Math.max(...monthlySales.map(s => Object.values(s.products).reduce((sum, p) => sum + (p?.revenueIncl || 0), 0) / 1000)).toFixed(1)}k
              </div>
              <div className="text-xs text-green-500 dark:text-green-400 mt-1 text-center">
                {(() => {
                  const revenues = monthlySales.map((s, idx) => ({ 
                    idx, 
                    rev: Object.values(s.products).reduce((sum, p) => sum + (p?.revenueIncl || 0), 0) 
                  }));
                  const best = revenues.reduce((max, curr) => curr.rev > max.rev ? curr : max);
                  const fileMonthMatch = monthlySales[best.idx].fileName && monthlySales[best.idx].fileName.match(/(\d{1,2})[-.](\d{1,2})[-.](\d{4})|(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
                  if (fileMonthMatch) {
                    const month = fileMonthMatch[1] ? fileMonthMatch[2] : fileMonthMatch[5];
                    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return monthNames[parseInt(month, 10)];
                  }
                  return `File ${best.idx + 1}`;
                })()}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 rounded-xl p-4 border-2 border-amber-200 dark:border-amber-700 shadow-md text-center">
              <div className="text-xs text-amber-600 dark:text-amber-400 font-bold mb-1 text-center">Avg Price/Unit</div>
              <div className="text-2xl md:text-3xl font-extrabold text-amber-700 dark:text-amber-300 text-center">
                ₪{totalUnits > 0 ? (totalRevenue / totalUnits).toFixed(0) : '0'}
              </div>
              <div className="text-xs text-amber-500 dark:text-amber-400 mt-1 text-center">
                Per blood unit
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                  <th className="text-left py-3 px-2 text-gray-700 dark:text-gray-300 font-bold">Month</th>
                  <th className="text-right py-3 px-2 text-gray-700 dark:text-gray-300 font-bold">Revenue</th>
                  <th className="text-center py-3 px-2 text-gray-700 dark:text-gray-300 font-bold">Trend</th>
                  <th className="text-right py-3 px-2 text-gray-700 dark:text-gray-300 font-bold">Units</th>
                  <th className="text-center py-3 px-2 text-gray-700 dark:text-gray-300 font-bold">Trend</th>
                  <th className="text-right py-3 px-2 text-gray-700 dark:text-gray-300 font-bold">Avg Price</th>
                  <th className="text-center py-3 px-2 text-gray-700 dark:text-gray-300 font-bold">vs Avg</th>
                </tr>
              </thead>
              <tbody>
                {monthlySales.map((sale, idx) => {
                  const revenue = Object.values(sale.products).reduce((sum, p) => sum + (p?.revenueIncl || 0), 0);
                  const units = Object.values(sale.products).reduce((sum, p) => sum + (p?.quantity || 0), 0);
                  const avgPrice = units > 0 ? revenue / units : 0;
                  
                  // Calculate trends (compare to previous month)
                  let revenueTrend = null;
                  let unitsTrend = null;
                  if (idx > 0) {
                    const prevRevenue = Object.values(monthlySales[idx - 1].products).reduce((sum, p) => sum + (p?.revenueIncl || 0), 0);
                    const prevUnits = Object.values(monthlySales[idx - 1].products).reduce((sum, p) => sum + (p?.quantity || 0), 0);
                    revenueTrend = ((revenue - prevRevenue) / prevRevenue * 100).toFixed(0);
                    unitsTrend = ((units - prevUnits) / prevUnits * 100).toFixed(0);
                  }
                  
                  // Compare to average
                  const avgRevenue = totalRevenue / monthlySales.length;
                  const vsAvg = ((revenue - avgRevenue) / avgRevenue * 100).toFixed(0);
                  
                  // Get month label
                  const fileMonthMatch = sale.fileName && sale.fileName.match(/(\d{1,2})[-.](\d{1,2})[-.](\d{4})|(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
                  let monthLabel = `File ${idx + 1}`;
                  if (fileMonthMatch) {
                    const month = fileMonthMatch[1] ? fileMonthMatch[2] : fileMonthMatch[5];
                    const year = fileMonthMatch[1] ? fileMonthMatch[3] : fileMonthMatch[4];
                    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    monthLabel = `${monthNames[parseInt(month, 10)]} '${year.slice(2)}`;
                  }
                  
                  return (
                    <tr key={idx} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-3 px-2 font-bold text-gray-800 dark:text-gray-200">{monthLabel}</td>
                      <td className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                        ₪{(revenue / 1000).toFixed(1)}k
                      </td>
                      <td className="text-center py-3 px-2">
                        {revenueTrend !== null && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                            parseFloat(revenueTrend) > 0 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : parseFloat(revenueTrend) < 0
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {parseFloat(revenueTrend) > 0 ? '↗' : parseFloat(revenueTrend) < 0 ? '↘' : '→'}
                            {Math.abs(revenueTrend)}%
                          </span>
                        )}
                        {revenueTrend === null && <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>}
                      </td>
                      <td className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                        {units.toFixed(0)}
                      </td>
                      <td className="text-center py-3 px-2">
                        {unitsTrend !== null && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                            parseFloat(unitsTrend) > 0 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : parseFloat(unitsTrend) < 0
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {parseFloat(unitsTrend) > 0 ? '↗' : parseFloat(unitsTrend) < 0 ? '↘' : '→'}
                            {Math.abs(unitsTrend)}%
                          </span>
                        )}
                        {unitsTrend === null && <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>}
                      </td>
                      <td className="text-right py-3 px-2 text-gray-700 dark:text-gray-300">
                        ₪{avgPrice.toFixed(0)}
                      </td>
                      <td className="text-center py-3 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                          parseFloat(vsAvg) > 5 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : parseFloat(vsAvg) < -5
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {parseFloat(vsAvg) > 0 ? '+' : ''}{vsAvg}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Sales Breakdown - Each import shown separately */}
      {monthlySales.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-2">No sales data yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">Click Import to add your first sales report</p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthlySales.map((sale, saleIndex) => {
            const saleTotal = Object.values(sale.products).reduce((sum, p) => sum + (p?.revenueIncl || 0), 0);
            const saleQuantity = Object.values(sale.products).reduce((sum, p) => sum + (p?.quantity || 0), 0);
            
            // Extract month from fileName - handles formats like "01.09.2024-30.09.2024" or "2024-09-01_2024-09-30"
            let monthLabel = 'Unknown';
            if (sale.fileName) {
              // Try to match date patterns: DD.MM.YYYY, YYYY-MM-DD, etc.
              const dateMatch = sale.fileName.match(/(\d{1,2})[-.](\d{1,2})[-.](\d{4})|(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
              if (dateMatch) {
                let month, year;
                if (dateMatch[1]) {
                  // Format: DD.MM.YYYY or DD-MM-YYYY
                  month = dateMatch[2];
                  year = dateMatch[3];
                } else {
                  // Format: YYYY-MM-DD or YYYY.MM.DD
                  year = dateMatch[4];
                  month = dateMatch[5];
                }
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthIndex = parseInt(month, 10) - 1;
                monthLabel = monthIndex >= 0 && monthIndex < 12 ? `${monthNames[monthIndex]} ${year}` : `${month}/${year}`;
              }
            }
            if (monthLabel === 'Unknown' && sale.date) {
              const d = new Date(sale.date);
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
              monthLabel = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            }
            
            // Calculate external sales for this month
            let externalQuantity = 0;
            let externalRevenue = 0;
            Object.keys(sale.products).forEach(productKey => {
              const p = sale.products[productKey];
              const product = BLOOD_PRODUCTS[productKey];
              if (p && p.external && p.external > 0) {
                externalQuantity += p.external;
                if (p.externalRevenue) {
                  externalRevenue += p.externalRevenue;
                } else if (p.revenueIncl && p.quantity) {
                  externalRevenue += (p.revenueIncl / p.quantity) * p.external;
                }
              }
            });
            const isExpanded = expandedMonths[saleIndex];
            
            return (
              <div key={saleIndex} className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                {/* DELETE button in top-right */}
                <button
                  onClick={() => deleteImportHistory(saleIndex)}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-xs font-bold transition-all shadow-md z-10"
                  title="Delete this month"
                >
                  DELETE
                </button>
                {/* Month Header - Clickable to expand/collapse */}
                <div 
                  onClick={() => toggleMonth(saleIndex)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:from-blue-600 hover:to-indigo-700 transition-all"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-2xl md:text-3xl">{isExpanded ? '📂' : '📁'}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-bold text-white truncate">{monthLabel}</h3>
                      <p className="text-[10px] md:text-xs text-blue-100 truncate">{sale.fileName || new Date(sale.date).toLocaleString('en-US')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-[10px] text-blue-100">Revenue</div>
                      <div className="text-base md:text-xl font-bold text-white">₪{(saleTotal/1000).toFixed(1)}k</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-blue-100">Units</div>
                      <div className="text-base md:text-xl font-bold text-white">{saleQuantity.toFixed(1)}</div>
                    </div>
                    <div className="text-white text-xl">{isExpanded ? '▼' : '▶'}</div>
                  </div>
                </div>
                {/* Collapsible Content */}
                {isExpanded && (
                  <>
                    {/* External Sales Summary */}
                    {externalQuantity > 0 && (
                      <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 p-3 border-b border-purple-200 dark:border-purple-700">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🏥</span>
                            <span className="font-bold text-purple-800 dark:text-purple-200">External Sales</span>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <div>
                              <span className="text-purple-600 dark:text-purple-300">Units:</span>
                              <span className="font-bold ml-1 text-purple-800 dark:text-purple-200">{externalQuantity}</span>
                            </div>
                            {externalRevenue > 0 && (
                              <div>
                                <span className="text-purple-600 dark:text-purple-300">Revenue:</span>
                                <span className="font-bold ml-1 text-purple-800 dark:text-purple-200">₪{(externalRevenue/1000).toFixed(1)}k</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Products Table */}
                    <div className="p-3 md:p-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                            <th className="text-left py-2 px-2 text-gray-700 dark:text-gray-300 font-semibold">Product</th>
                            <th className="text-right py-2 px-2 text-gray-700 dark:text-gray-300 font-semibold">Qty</th>
                            <th className="text-right py-2 px-2 text-gray-700 dark:text-gray-300 font-semibold">Revenue</th>
                            <th className="text-right py-2 px-2 text-gray-700 dark:text-gray-300 font-semibold">Avg Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(sale.products).map(productKey => {
                            const p = sale.products[productKey];
                            const product = BLOOD_PRODUCTS[productKey];
                            const avgPrice = p.quantity > 0 ? p.revenueIncl / p.quantity : 0;
                            return (
                              <tr key={productKey} className="border-b border-gray-200 dark:border-gray-700">
                                <td className="py-2 px-2 font-medium text-gray-800 dark:text-gray-200">{product?.name_en || productKey}</td>
                                <td className="text-right py-2 px-2 text-gray-700 dark:text-gray-300">{p.quantity?.toFixed(1) || '0'}</td>
                                <td className="text-right py-2 px-2 text-gray-700 dark:text-gray-300">₪{(p.revenueIncl/1000)?.toFixed(2) || '0'}k</td>
                                <td className="text-right py-2 px-2 text-gray-700 dark:text-gray-300">₪{avgPrice?.toFixed(0) || '0'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FinancialTracker;
