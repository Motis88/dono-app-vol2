import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseCsvFile } from '../utils/csvImporter';

// Blood product definitions
const BLOOD_PRODUCTS = {
  'מנת דם טרי כלב': { code: 'FRESH_BLOOD_DOG', name_en: 'Fresh Whole Blood Dog', species: 'dog' },
  'מנת דם מלא- חתול  mdm cat': { code: 'WHOLE_BLOOD_CAT', name_en: 'Whole Blood Cat', species: 'cat' },
  'מנת דם מלא- כלב n mdm dog': { code: 'WHOLE_BLOOD_DOG', name_en: 'Whole Blood Dog', species: 'dog' },
  'מנת דם פלסמה חתול  mdp cat': { code: 'PLASMA_CAT', name_en: 'Plasma Cat', species: 'cat' },
  'מנת דם פלסמה כלב  mdp dog': { code: 'PLASMA_DOG', name_en: 'Plasma Dog', species: 'dog' },
  'מנת דם תרכיז תאים כלב  mdtt dog': { code: 'PRBC_DOG', name_en: 'pRBC Dog', species: 'dog' },
  'מנת דם תרכיז תאים-גדול-חתול  mdttbig cat': { code: 'PRBC_CAT', name_en: 'pRBC Large Cat', species: 'cat' },
};

const FINANCIAL_STORAGE_KEY = 'financial_data';

const FinancialTracker = () => {
  const { colors } = useTheme();
  const [monthlySales, setMonthlySales] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = () => {
    const saved = localStorage.getItem(FINANCIAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMonthlySales(parsed.sales || []);
      } catch (e) {
        console.error('Error loading financial data:', e);
      }
    }
  };

  const saveFinancialData = (sales) => {
    localStorage.setItem(FINANCIAL_STORAGE_KEY, JSON.stringify({
      sales: sales,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const importSalesCSV = async (file) => {
    setImporting(true);
    try {
      let parsedData;
      
      // Check if file is Excel or CSV
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });
        
        const csvText = Papa.unparse(jsonData);
        const csvBlob = new Blob([csvText], { type: 'text/csv' });
        const csvFile = new File([csvBlob], 'converted.csv', { type: 'text/csv' });
        parsedData = await parseCsvFile(csvFile);
      } else {
        parsedData = await parseCsvFile(file);
      }
      
      console.log('Parsed data:', parsedData);
      
      if (parsedData.length === 0) {
        alert('❌ No valid data found in file');
        setImporting(false);
        return;
      }

      // Process sales data - group by month
      const salesByMonth = {}; // { 'YYYY-MM': { products: {} } }
      let totalImported = 0;

      parsedData.forEach(item => {
        if (item.type === 'sale' && item.productName && item.quantity > 0) {
          const itemDate = item.date || new Date().toISOString().split('T')[0];
          const monthKey = itemDate.substring(0, 7); // YYYY-MM
          
          console.log('Processing:', item.productName, 'Date:', itemDate, 'Month:', monthKey, 'Qty:', item.quantity, 'Revenue:', item.totalInclVat);
          
          // Try to match with known blood products
          let matchedProduct = null;
          
          // Direct match
          if (BLOOD_PRODUCTS[item.productName]) {
            matchedProduct = item.productName;
          } else {
            // Fuzzy match - look for product codes
            const itemNameLower = item.productName.toLowerCase();
            
            if (itemNameLower.includes('mdm') && itemNameLower.includes('cat')) {
              matchedProduct = 'מנת דם מלא- חתול  mdm cat';
            } else if (itemNameLower.includes('mdm') && itemNameLower.includes('dog')) {
              matchedProduct = 'מנת דם מלא- כלב n mdm dog';
            } else if (itemNameLower.includes('mdp') && itemNameLower.includes('cat')) {
              matchedProduct = 'מנת דם פלסמה חתול  mdp cat';
            } else if (itemNameLower.includes('mdp') && itemNameLower.includes('dog')) {
              matchedProduct = 'מנת דם פלסמה כלב  mdp dog';
            } else if (itemNameLower.includes('mdttbig') && itemNameLower.includes('cat')) {
              matchedProduct = 'מנת דם תרכיז תאים-גדול-חתול  mdttbig cat';
            } else if (itemNameLower.includes('mdtt') && itemNameLower.includes('dog')) {
              matchedProduct = 'מנת דם תרכיז תאים כלב  mdtt dog';
            }
          }

          // Skip non-blood products
          if (!matchedProduct) {
            console.log('❌ Skipping non-blood product:', item.productName);
            return;
          }

          // Initialize month if needed
          if (!salesByMonth[monthKey]) {
            salesByMonth[monthKey] = { products: {} };
          }

          // Initialize product in this month if needed
          if (!salesByMonth[monthKey].products[matchedProduct]) {
            salesByMonth[monthKey].products[matchedProduct] = { 
              quantity: 0, 
              revenueIncl: 0 
            };
          }

          salesByMonth[monthKey].products[matchedProduct].quantity += item.quantity;
          salesByMonth[monthKey].products[matchedProduct].revenueIncl += item.totalInclVat || 0;
          totalImported++;
        }
      });

      if (Object.keys(salesByMonth).length === 0) {
        alert('❌ No blood products found for import');
        setImporting(false);
        return;
      }

      console.log('Sales by month:', salesByMonth);

      // Create monthly sales entries
      const newSales = Object.keys(salesByMonth).map(monthKey => ({
        monthKey, // YYYY-MM
        products: salesByMonth[monthKey].products
      }));

      // Merge with existing data
      const updatedSales = [...monthlySales];
      newSales.forEach(newMonth => {
        const existingIndex = updatedSales.findIndex(m => m.monthKey === newMonth.monthKey);
        if (existingIndex >= 0) {
          // Merge products into existing month
          Object.keys(newMonth.products).forEach(productKey => {
            if (!updatedSales[existingIndex].products[productKey]) {
              updatedSales[existingIndex].products[productKey] = { quantity: 0, revenueIncl: 0 };
            }
            updatedSales[existingIndex].products[productKey].quantity += newMonth.products[productKey].quantity;
            updatedSales[existingIndex].products[productKey].revenueIncl += newMonth.products[productKey].revenueIncl;
          });
        } else {
          // Add new month
          updatedSales.push(newMonth);
        }
      });

      // Sort by month (newest first)
      updatedSales.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      
      setMonthlySales(updatedSales);
      saveFinancialData(updatedSales);
      
      setImporting(false);
      setShowImport(false);
      
      const monthCount = Object.keys(salesByMonth).length;
      alert(`✅ Import successful!\n\n${totalImported} sales records\n${monthCount} months`);
      
    } catch (error) {
      console.error('Import error:', error);
      setImporting(false);
      alert(`❌ Import error: ${error.message}`);
    }
  };

  const resetAllData = () => {
    if (!window.confirm('⚠️ Delete all financial data? This cannot be undone!')) return;
    setMonthlySales([]);
    localStorage.removeItem(FINANCIAL_STORAGE_KEY);
    alert('✅ All data deleted');
  };

  const toggleMonth = (monthKey) => {
    setExpandedMonth(expandedMonth === monthKey ? null : monthKey);
  };

  const deleteMonth = (monthKey) => {
    if (!window.confirm(`Delete month ${monthKey}?`)) return;
    const updated = monthlySales.filter(m => m.monthKey !== monthKey);
    setMonthlySales(updated);
    saveFinancialData(updated);
  };

  // Calculate averages
  const calculateAverages = () => {
    if (monthlySales.length === 0) return null;

    const productTotals = {};
    let totalUnits = 0;
    let totalRevenue = 0;

    monthlySales.forEach(month => {
      Object.keys(month.products).forEach(productKey => {
        const product = month.products[productKey];
        if (!productTotals[productKey]) {
          productTotals[productKey] = { quantity: 0, revenueIncl: 0 };
        }
        productTotals[productKey].quantity += product.quantity;
        productTotals[productKey].revenueIncl += product.revenueIncl;
        totalUnits += product.quantity;
        totalRevenue += product.revenueIncl;
      });
    });

    const monthCount = monthlySales.length;
    const productAverages = {};
    
    Object.keys(productTotals).forEach(productKey => {
      productAverages[productKey] = {
        avgQuantity: productTotals[productKey].quantity / monthCount,
        avgRevenue: productTotals[productKey].revenueIncl / monthCount,
        totalQuantity: productTotals[productKey].quantity,
        totalRevenue: productTotals[productKey].revenueIncl
      };
    });

    const months = monthlySales.map(m => m.monthKey).sort();
    const dateRange = months.length > 0 ? `${months[0]} - ${months[months.length - 1]}` : '';

    return {
      avgUnitsPerMonth: totalUnits / monthCount,
      avgRevenuePerMonth: totalRevenue / monthCount,
      productAverages,
      monthCount,
      dateRange,
      totalUnits,
      totalRevenue
    };
  };

  const averages = calculateAverages();

  const formatMonth = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className={`min-h-screen ${colors.bg.primary} p-4`}>
      <div className={`max-w-7xl mx-auto ${colors.bg.card} rounded-2xl shadow-lg p-6 ${colors.border.primary} border`}>
        {/* Import Modal */}
        {showImport && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
            <div className={`${colors.bg.card} rounded-2xl p-6 max-w-md w-full`} onClick={e => e.stopPropagation()}>
              <h3 className={`text-2xl font-bold mb-4 ${colors.text.primary}`}>Import Sales File</h3>
              <p className={`text-sm mb-4 ${colors.text.secondary}`}>
                Upload CSV or Excel file (Item Sales format)
              </p>
              <input 
                type="file" 
                accept=".csv,.txt,.xlsx,.xls"
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              💰 Sales Tracker
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowImport(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              📥 Import
            </button>
            <button
              onClick={resetAllData}
              className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:from-red-600 hover:to-rose-700 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              🗑️ Reset
            </button>
          </div>
        </div>

        {/* Averages Summary */}
        {averages && (
          <div className={`${colors.bg.secondary} rounded-xl p-4 mb-6 border ${colors.border.primary}`}>
            <h3 className={`text-lg font-bold mb-3 ${colors.text.primary}`}>
              📊 Summary ({averages.monthCount} months: {averages.dateRange})
            </h3>

            {/* Overall Averages */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`${colors.bg.card} rounded-lg p-3 border ${colors.border.primary}`}>
                <div className={`text-xs ${colors.text.secondary} mb-0.5`}>Avg Units/Month</div>
                <div className={`text-xl font-bold ${colors.text.primary}`}>
                  {averages.avgUnitsPerMonth.toFixed(1)}
                </div>
                <div className={`text-xs ${colors.text.secondary}`}>
                  Total: {averages.totalUnits.toFixed(1)}
                </div>
              </div>
              <div className={`${colors.bg.card} rounded-lg p-3 border ${colors.border.primary}`}>
                <div className={`text-xs ${colors.text.secondary} mb-0.5`}>Avg Revenue/Month</div>
                <div className={`text-xl font-bold ${colors.text.primary}`}>
                  ₪{averages.avgRevenuePerMonth.toFixed(0)}
                </div>
                <div className={`text-xs ${colors.text.secondary}`}>
                  Total: ₪{averages.totalRevenue.toFixed(0)}
                </div>
              </div>
            </div>

            {/* Product Averages */}
            <h4 className={`text-sm font-bold mb-2 ${colors.text.primary}`}>By Product</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.keys(averages.productAverages)
                .sort((a, b) => averages.productAverages[b].totalRevenue - averages.productAverages[a].totalRevenue)
                .map(productKey => {
                  const avg = averages.productAverages[productKey];
                  const product = BLOOD_PRODUCTS[productKey];
                  return (
                    <div key={productKey} className={`${colors.bg.card} rounded-lg p-2 border ${colors.border.primary}`}>
                      <div className="flex justify-between items-center mb-1">
                        <div className={`text-sm font-bold ${colors.text.primary}`}>
                          {product?.name_en || productKey}
                        </div>
                        <div className={`text-xs ${colors.text.secondary}`}>
                          {product?.species === 'dog' ? '🐕' : '🐈'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className={`${colors.text.secondary}`}>Avg/mo</div>
                          <div className={`font-bold ${colors.text.primary}`}>{avg.avgQuantity.toFixed(1)} u</div>
                        </div>
                        <div>
                          <div className={`${colors.text.secondary}`}>Revenue/mo</div>
                          <div className={`font-bold ${colors.text.primary}`}>₪{avg.avgRevenue.toFixed(0)}</div>
                        </div>
                        <div>
                          <div className={`${colors.text.secondary}`}>Total</div>
                          <div className={`font-bold ${colors.text.primary}`}>{avg.totalQuantity.toFixed(1)} u</div>
                        </div>
                        <div>
                          <div className={`${colors.text.secondary}`}>Total ₪</div>
                          <div className={`font-bold ${colors.text.primary}`}>₪{avg.totalRevenue.toFixed(0)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Monthly Cards */}
        <div className="space-y-3">
          <h3 className={`text-lg font-bold ${colors.text.primary} mb-3`}>📅 Monthly Data</h3>
          
          {monthlySales.length === 0 && (
            <div className={`text-center py-8 ${colors.text.secondary}`}>
              <p className="text-base mb-1">No sales data</p>
              <p className="text-sm">Click "Import" to start</p>
            </div>
          )}

          {monthlySales.map((month) => {
            const isExpanded = expandedMonth === month.monthKey;
            const monthTotal = Object.values(month.products).reduce((sum, p) => sum + p.revenueIncl, 0);
            const monthUnits = Object.values(month.products).reduce((sum, p) => sum + p.quantity, 0);

            return (
              <div key={month.monthKey} className={`${colors.bg.secondary} rounded-lg border ${colors.border.primary} overflow-hidden`}>
                {/* Month Header - Clickable */}
                <div 
                  className={`p-3 cursor-pointer hover:bg-opacity-80 transition-all ${isExpanded ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10' : ''}`}
                  onClick={() => toggleMonth(month.monthKey)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className={`text-base font-bold ${colors.text.primary}`}>
                        {formatMonth(month.monthKey)}
                      </div>
                      <div className={`text-xs ${colors.text.secondary} mt-0.5`}>
                        {monthUnits.toFixed(1)} units • ₪{monthTotal.toFixed(0)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMonth(month.monthKey);
                        }}
                        className="text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-500/10 transition-all text-sm"
                      >
                        🗑️
                      </button>
                      <span className={`text-xl ${colors.text.primary}`}>
                        {isExpanded ? '▼' : '◀'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Month Details - Expanded */}
                {isExpanded && (
                  <div className={`p-3 pt-0 border-t ${colors.border.primary}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {Object.keys(month.products).map(productKey => {
                        const product = month.products[productKey];
                        const productInfo = BLOOD_PRODUCTS[productKey];
                        return (
                          <div key={productKey} className={`${colors.bg.card} rounded-lg p-2 border ${colors.border.primary}`}>
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className={`text-sm font-bold ${colors.text.primary}`}>
                                  {productInfo?.name_en || productKey}
                                </div>
                                <div className={`text-xs ${colors.text.secondary}`}>
                                  {productInfo?.species === 'dog' ? '🐕' : '🐈'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-sm font-bold ${colors.text.primary}`}>
                                  {product.quantity.toFixed(1)} u
                                </div>
                                <div className={`text-xs ${colors.text.secondary}`}>
                                  ₪{product.revenueIncl.toFixed(0)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FinancialTracker;
