import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { parseCsvFile, exportToCsv, getDataSummary } from '../utils/csvImporter';
import EnhancedFinancialDashboard from './EnhancedFinancialDashboard';

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
      let parsedData;
      
      // Check if file is Excel or CSV
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });
        
        // Convert to CSV-like format for the parser
        const csvText = Papa.unparse(jsonData);
        const csvBlob = new Blob([csvText], { type: 'text/csv' });
        const csvFile = new File([csvBlob], 'converted.csv', { type: 'text/csv' });
        parsedData = await parseCsvFile(csvFile);
      } else {
        // Parse CSV file normally
        parsedData = await parseCsvFile(file);
      }
      
      if (parsedData.length === 0) {
        alert('❌ לא נמצאו נתונים תקינים בקובץ');
        setImporting(false);
        return;
      }

      // Get summary of imported data
      const summary = getDataSummary(parsedData);
      console.log('Import summary:', summary);

      // Process sales data - group by month
      const salesByMonth = {}; // { 'YYYY-MM': { date, products: {} } }
      let totalImported = 0;

      parsedData.forEach(item => {
        if (item.type === 'sale' && item.productName && item.quantity > 0) {
          // Get month from item date
          const itemDate = item.date || new Date().toISOString().split('T')[0];
          const monthKey = itemDate.substring(0, 7); // YYYY-MM
          
          // Debug: log first few items to see dates
          if (totalImported < 5) {
            console.log('Item date:', item.date, '→ monthKey:', monthKey, 'Product:', item.productName);
          }
          
          // Try to match with known blood products
          let matchedProduct = null;
          
          // Direct match
          if (BLOOD_PRODUCTS[item.productName]) {
            matchedProduct = item.productName;
          } else {
            // Fuzzy match
            Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
              const simplifiedProduct = productKey.replace(/[^א-ת\w]/g, '').toLowerCase();
              const simplifiedItem = item.productName.replace(/[^א-ת\w]/g, '').toLowerCase();
              
              if (simplifiedItem.includes(simplifiedProduct.substring(0, 6)) || 
                  simplifiedProduct.includes(simplifiedItem.substring(0, 6))) {
                matchedProduct = productKey;
              }
            });
          }

          // If no match found, create generic entry
          if (!matchedProduct) {
            matchedProduct = item.productName;
          }

          // Initialize month if needed
          if (!salesByMonth[monthKey]) {
            salesByMonth[monthKey] = {
              date: itemDate,
              products: {}
            };
          }

          // Initialize product in this month if needed
          if (!salesByMonth[monthKey].products[matchedProduct]) {
            salesByMonth[monthKey].products[matchedProduct] = { quantity: 0, revenueExcl: 0, revenueIncl: 0 };
          }

          salesByMonth[monthKey].products[matchedProduct].quantity += item.quantity;
          salesByMonth[monthKey].products[matchedProduct].revenueExcl += item.totalExclVat || 0;
          salesByMonth[monthKey].products[matchedProduct].revenueIncl += item.totalInclVat || 0;
          totalImported++;
        }

        // Process medicine usage data
        if (item.type === 'medicine_usage' && item.medicine && item.quantityUnits > 0) {
          const itemDate = item.date || new Date().toISOString().split('T')[0];
          const monthKey = itemDate.substring(0, 7);
          const medicineKey = `${item.medicine} (שימוש)`;
          
          if (!salesByMonth[monthKey]) {
            salesByMonth[monthKey] = {
              date: itemDate,
              products: {}
            };
          }

          if (!salesByMonth[monthKey].products[medicineKey]) {
            salesByMonth[monthKey].products[medicineKey] = { quantity: 0, revenueExcl: 0, revenueIncl: 0 };
          }

          salesByMonth[monthKey].products[medicineKey].quantity += item.quantityUnits;
          totalImported++;
        }
      });

      if (Object.keys(salesByMonth).length === 0) {
        alert('❌ לא נמצאו מוצרים תקינים לייבוא');
        setImporting(false);
        return;
      }

      // Create monthly sales entries - use first day of month as date
      const newSales = Object.keys(salesByMonth).map(monthKey => ({
        monthKey, // explicit month identifier YYYY-MM
        date: `${monthKey}-15T12:00:00.000Z`, // canonical mid-month date
        // Preserve original file reference but DON'T depend on it for month parsing
        fileName: `${file.name} (${monthKey})`,
        products: salesByMonth[monthKey].products,
        importSummary: summary
      }));

      // Update total financial data (all-time totals)
      const updatedData = { ...financialData };
      Object.keys(salesByMonth).forEach(monthKey => {
        Object.keys(salesByMonth[monthKey].products).forEach(productKey => {
          if (!updatedData[productKey]) {
            updatedData[productKey] = { quantity: 0, revenueExcl: 0, revenueIncl: 0 };
          }
          updatedData[productKey].quantity += salesByMonth[monthKey].products[productKey].quantity;
          updatedData[productKey].revenueExcl += salesByMonth[monthKey].products[productKey].revenueExcl;
          updatedData[productKey].revenueIncl += salesByMonth[monthKey].products[productKey].revenueIncl;
        });
      });
      
      const updatedHistory = [...monthlySales, ...newSales];
      
      setFinancialData(updatedData);
      setMonthlySales(updatedHistory);
      saveFinancialData(updatedData, updatedHistory);
      
      setImporting(false);
      setShowImport(false);
      
      const monthCount = Object.keys(salesByMonth).length;
      const productCount = new Set(Object.values(salesByMonth).flatMap(m => Object.keys(m.products))).size;
      alert(`✅ ייבוא הושלם בהצלחה!\n\nיובאו ${totalImported} רשומות\nחולקו ל-${monthCount} חודשים\n${productCount} מוצרים שונים\nסוג קובץ: ${summary.types.sale ? 'מכירות' : ''} ${summary.types.medicine_usage ? 'שימוש בתרופות' : ''}`);
      
    } catch (error) {
      console.error('Import error:', error);
      setImporting(false);
      alert(`❌ שגיאה בייבוא: ${error.message}`);
    }
  };

  const deleteImportHistory = (index) => {
    if (!window.confirm('🗑️ Remove this file from history? (Your financial data will remain unchanged)')) return;
    
    try {
      // Simply remove from history without affecting the financial summary
      const updatedHistory = monthlySales.filter((_, i) => i !== index);
      
      setMonthlySales(updatedHistory);
      saveFinancialData(financialData, updatedHistory);
      
      alert('✅ File removed from history');
    } catch (error) {
      console.error('Delete error:', error);
      alert('❌ Remove failed');
    }
  };


  // Get previous month's external sales (units and revenue) from inventory import history
  const getPrevMonthExternalSales = () => {
    try {
      const inventoryData = localStorage.getItem('blood_inventory');
      if (inventoryData) {
        const parsed = JSON.parse(inventoryData);
        const sales = parsed.sales || [];
        const now = new Date();
        let prevMonth = now.getMonth() - 1; // Previous month (0-based)
        let prevYear = now.getFullYear();
        if (prevMonth < 0) {
          prevMonth = 11; // December
          prevYear--;
        }
        // Find the latest sale from previous month
        const prevMonthSale = [...sales].reverse().find(sale => {
          const d = new Date(sale.date);
          return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });
        if (!prevMonthSale || !prevMonthSale.external) {
          return { externalSummary: {}, totalExternalUnits: 0, totalExternalRevenue: 0 };
        }
        // Revenue: use FinancialTracker's prevMonthSale for product prices
        const productPrices = {};
        if (monthlySales.length > 0) {
          const finPrevMonthSale = [...monthlySales].reverse().find(sale => {
            const d = new Date(sale.date);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
          });
          if (finPrevMonthSale) {
            Object.keys(finPrevMonthSale.products).forEach(productKey => {
              productPrices[productKey] = {
                avgPrice: finPrevMonthSale.products[productKey].quantity > 0 ?
                  finPrevMonthSale.products[productKey].revenueIncl / finPrevMonthSale.products[productKey].quantity : 0,
                product: BLOOD_PRODUCTS[productKey]
              };
            });
          }
        }
        const externalSummary = {};
        let totalExternalUnits = 0;
        let totalExternalRevenue = 0;
        Object.keys(prevMonthSale.external).forEach(productKey => {
          const units = prevMonthSale.external[productKey];
          const price = productPrices[productKey]?.avgPrice || 0;
          const revenue = units * price;
          externalSummary[productKey] = {
            units,
            revenue,
            product: BLOOD_PRODUCTS[productKey]
          };
          totalExternalUnits += units;
          totalExternalRevenue += revenue;
        });
        return { externalSummary, totalExternalUnits, totalExternalRevenue };
      }
    } catch (error) {
      console.error('Error loading inventory data:', error);
    }
    return { externalSummary: {}, totalExternalUnits: 0, totalExternalRevenue: 0 };
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

  // Export financial report
  const exportFinancialReport = async () => {
    try {
      // Check if we have data
      console.log('Financial Data:', financialData);
      console.log('Monthly Sales:', monthlySales);
      if (monthlySales.length === 0) {
        alert('❌ No monthly sales data to export. Please import sales data first.');
        return;
      }
      
      // Get previous month data
      const now = new Date();
      let prevMonth = now.getMonth() - 1; // Previous month (0-based)
      let prevYear = now.getFullYear();
      if (prevMonth < 0) {
        prevMonth = 11; // December
        prevYear--;
      }
      // Find the latest sale from previous month
      const prevMonthSale = [...monthlySales].reverse().find(sale => {
        const d = new Date(sale.date);
        return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
      });
      
      // If no previous month data found, try using the most recent data instead
      let selectedSale = prevMonthSale;
      let reportPeriod = '';
      
      if (!prevMonthSale) {
        console.log('No previous month data found, using most recent data');
        selectedSale = monthlySales[monthlySales.length - 1];
        if (!selectedSale) {
          alert('❌ No sales data available to export.');
          return;
        }
        const saleDate = new Date(selectedSale.date);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        reportPeriod = `${monthNames[saleDate.getMonth()]} ${saleDate.getFullYear()} (Most Recent)`;
      } else {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        reportPeriod = `${monthNames[prevMonth]} ${prevYear}`;
      }
      const prevRevenue = Object.values(selectedSale.products).reduce((sum, p) => sum + (p?.revenueIncl || 0), 0);
      const prevUnits = Object.values(selectedSale.products).reduce((sum, p) => sum + (p?.quantity || 0), 0);
      
      const csvData = [];
      
      // Header
  csvData.push(['Monthly Financial Report - Generated ' + new Date().toLocaleDateString('en-US')]);
  csvData.push(['Report Period:', reportPeriod]);
      csvData.push(['']);
      
      // Previous Month Summary
      csvData.push(['=== Report Period Summary ===']);
      csvData.push(['Period Revenue:', `$${prevRevenue.toLocaleString()}`]);
      csvData.push(['Period Units Sold:', prevUnits]);
      csvData.push(['Average Price per Unit:', prevUnits > 0 ? `$${Math.round(prevRevenue / prevUnits)}` : '$0']);
      csvData.push(['']);
      // Previous Month Products breakdown
      csvData.push(['=== Report Period Products Detail ===']);
      csvData.push(['Product', 'Species', 'Units', 'Revenue (Excl)', 'Revenue (Incl)', 'Avg Price']);
      Object.keys(selectedSale.products).forEach(productKey => {
        const product = selectedSale.products[productKey];
        const productInfo = BLOOD_PRODUCTS[productKey];
        const avgPrice = product.quantity > 0 ? Math.round(product.revenueIncl / product.quantity) : 0;
        csvData.push([
          productInfo?.name_en || productKey,
          productInfo?.species || 'Unknown',
          product.quantity || 0,
          `$${(product.revenueExcl || 0).toLocaleString()}`,
          `$${(product.revenueIncl || 0).toLocaleString()}`,
          `$${avgPrice}`
        ]);
      });
      csvData.push(['']);
      
      // Blood Products Only Summary
      // (Removed duplicate blood products summary section)
      
      // External inventory data for previous month
      const { externalSummary, totalExternalUnits, totalExternalRevenue } = getPrevMonthExternalSales();
      if (totalExternalUnits > 0) {
        csvData.push(['=== External Blood Products (From Inventory, Previous Month) ===']);
        csvData.push(['Product Code', 'Species', 'Units Used', 'Revenue (₪)']);
        Object.keys(externalSummary).forEach(productKey => {
          const data = externalSummary[productKey];
          csvData.push([
            data.product.code,
            data.product.species || 'Unknown',
            data.units,
            data.revenue ? `₪${Math.round(data.revenue)}` : ''
          ]);
        });
        csvData.push(['Total External Units:', totalExternalUnits]);
        csvData.push(['Total External Revenue:', `₪${Math.round(totalExternalRevenue)}`]);
        csvData.push(['']);
      }
      
      const csv = Papa.unparse(csvData);
      const fileName = `latest_month_report_${new Date().toISOString().slice(0, 10)}.csv`;
      
      // Save file using Capacitor Filesystem API
      try {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: csv,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        console.log('File saved:', savedFile);

        // Share the saved file
        await Share.share({
          title: 'Financial Report',
          text: 'Here is the financial report.',
          url: savedFile.uri,
          dialogTitle: 'Share Financial Report'
        });
        console.log('File shared successfully.');
      } catch (filesystemError) {
        console.error('Filesystem error:', filesystemError);
        alert('❌ Failed to save or share the file.');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Export failed');
    }
  };

  return (
    <div className={`min-h-screen ${colors.bg.primary} p-2 md:p-4`}>
      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
          <div className={`${colors.bg.card} rounded-2xl p-6 max-w-md w-full`} onClick={e => e.stopPropagation()}>
            <h3 className={`text-2xl font-bold mb-4 ${colors.text.primary}`}>Import Sales CSV / Excel</h3>
            <input 
              type="file" 
              accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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

      {/* Header with Action Buttons */}
      <div className={`${colors.bg.card} rounded-2xl shadow-lg p-4 mb-6`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className={`text-2xl font-bold ${colors.text.primary} mb-2`}>💰 Financial Tracker</h2>
            {monthlySales.length > 0 && (
              <div className="flex gap-4 text-sm">
                <div className={`${colors.text.secondary}`}>
                  <span className="font-semibold">Reports:</span> {monthlySales.length}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowImport(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
              <span>📥</span>
              <span className="text-sm">Import CSV</span>
            </button>
            <button
              onClick={exportFinancialReport}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
              <span>📄</span>
              <span className="text-sm">Export</span>
            </button>
            <button
              onClick={resetAllData}
              className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-2 rounded-xl font-bold hover:from-red-600 hover:to-rose-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
              <span>🗑️</span>
              <span className="text-sm">Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Component */}
      <EnhancedFinancialDashboard salesHistory={monthlySales} />
    </div>
  );
};

export default FinancialTracker;
