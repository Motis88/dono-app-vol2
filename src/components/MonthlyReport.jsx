import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { donorStorage } from '../utils/storage';
import { LOCATIONS } from '../utils/constants';
import Papa from 'papaparse';
import { Share } from '@capacitor/share';

// Import Dashboard functions to reuse statistics
import DonorDashboard from './DonorDashboard';

// Blood product definitions for reporting
const BLOOD_PRODUCTS = {
  'מנת דם טרי כלב': { code: 'FRESH BLOOD', type: 'fresh', species: 'dog', name_he: 'דם טרי כלב', name_en: 'Fresh Whole Blood Dog' },
  'מנת דם מלא- חתול  mdm cat': { code: 'WHOLE BLOOD CAT', type: 'whole', species: 'cat', name_he: 'דם מלא חתול', name_en: 'Whole Blood Cat' },
  'מנת דם מלא- כלב n mdm dog': { code: 'WHOLE BLOOD DOG', type: 'whole', species: 'dog', name_he: 'דם מלא כלב', name_en: 'Whole Blood Dog' },
  'מנת דם פלסמה חתול  mdp cat': { code: 'PLASMA CAT', type: 'plasma', species: 'cat', name_he: 'פלסמה חתול', name_en: 'Plasma Cat' },
  'מנת דם פלסמה כלב  mdp dog': { code: 'PLASMA DOG', type: 'plasma', species: 'dog', name_he: 'פלסמה כלב', name_en: 'Plasma Dog' },
  'מנת דם תרכיז תאים כלב  mdtt dog': { code: 'PC DOG', type: 'prbc', species: 'dog', name_he: 'תרכיז תאים כלב', name_en: 'pRBC Dog' },
  'מנת דם תרכיז תאים-גדול-חתול  mdttbig cat': { code: 'PC CAT', type: 'prbc_large', species: 'cat', name_he: 'תרכיז תאים גדול חתול', name_en: 'pRBC Large Cat' },
};

const MonthlyReport = () => {
  const { colors } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [reportData, setReportData] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Generate report data for selected month
  const generateReportData = () => {
    setGenerating(true);
    
    try {
      const allDonors = donorStorage.getDonors() || [];
      const inventoryData = JSON.parse(localStorage.getItem('blood_inventory') || '{"current": {}, "sales": []}');
      
      // Load financial data correctly from FinancialTracker format
      const savedFinancialData = JSON.parse(localStorage.getItem('financial_data') || '{"summary": {}, "sales": []}');
      const financialSummaryData = savedFinancialData.summary || {};
      const financialSalesHistory = savedFinancialData.sales || [];
      
      const monthYear = selectedMonth; // YYYY-MM
      const [year, month] = monthYear.split('-');
      
      // Filter donors by month
      const monthDonors = allDonors.filter(donor => {
        if (!donor.date) return false;
        const donorMonth = donor.date.slice(0, 7); // Extract YYYY-MM
        return donorMonth === monthYear;
      });
      
      // Calculate donor statistics using same logic as Dashboard
      const donorStats = {
        totalDonors: monthDonors.length,
        totalDonations: monthDonors.filter(d => d.donated === 'Yes').length,
        privateOwners: monthDonors.filter(d => d.isPrivateOwner).length,
        dogDonors: monthDonors.filter(d => d.animalType?.toLowerCase() === 'dog').length,
        catDonors: monthDonors.filter(d => d.animalType?.toLowerCase() === 'cat').length
      };
      
      // Calculate financial summary from monthly import history
      // Each import represents all sales from a specific month
      const monthSales = financialSalesHistory.filter(sale => {
        if (!sale.date) return false;
        const importMonth = sale.date.slice(0, 7); // When the file was imported
        return importMonth === monthYear;
      });
      
      const financialSummary = {
        totalRevenue: 0,
        totalExpenses: 0, // Not tracked in the system
        netProfit: 0,
        externalSales: {
          revenue: 0,
          units: 0,
          byProduct: {}
        },
        internalSales: {
          revenue: 0,
          units: 0
        }
      };
      
      // Sum up the sales from imported files for the selected month
      monthSales.forEach(sale => {
        Object.keys(sale.products || {}).forEach(productKey => {
          const product = sale.products[productKey];
          const revenue = product.revenueIncl || 0;
          const units = product.quantity || 0;
          
          financialSummary.totalRevenue += revenue;
          financialSummary.externalSales.revenue += revenue;
          financialSummary.externalSales.units += units;
          
          if (!financialSummary.externalSales.byProduct[productKey]) {
            financialSummary.externalSales.byProduct[productKey] = { revenue: 0, units: 0 };
          }
          financialSummary.externalSales.byProduct[productKey].revenue += revenue;
          financialSummary.externalSales.byProduct[productKey].units += units;
        });
      });
      
      // If no imports found for selected month, use cumulative data as fallback
      let isUsingFallback = false;
      if (monthSales.length === 0 && financialSalesHistory.length > 0) {
        // Use all available data as fallback
        financialSalesHistory.forEach(sale => {
          Object.keys(sale.products || {}).forEach(productKey => {
            const product = sale.products[productKey];
            const revenue = product.revenueIncl || 0;
            const units = product.quantity || 0;
            
            financialSummary.totalRevenue += revenue;
            financialSummary.externalSales.revenue += revenue;
            financialSummary.externalSales.units += units;
            
            if (!financialSummary.externalSales.byProduct[productKey]) {
              financialSummary.externalSales.byProduct[productKey] = { revenue: 0, units: 0 };
            }
            financialSummary.externalSales.byProduct[productKey].revenue += revenue;
            financialSummary.externalSales.byProduct[productKey].units += units;
          });
        });
        isUsingFallback = true;
        financialSummary.netProfit = financialSummary.totalRevenue - financialSummary.totalExpenses;
      }
      
      financialSummary.netProfit = financialSummary.totalRevenue - financialSummary.totalExpenses;
      
      // Get inventory external sales data from current state (not monthly history)
      const inventoryExternal = {};
      if (inventoryData.current) {
        Object.keys(inventoryData.current).forEach(productKey => {
          const product = inventoryData.current[productKey];
          if (product.external && product.external > 0) {
            inventoryExternal[productKey] = product.external;
          }
        });
      }
      
      console.log(`=== Monthly Report Full Debug for ${monthYear} ===`);
      console.log('1. Financial Data:', {
        hasSavedData: !!savedFinancialData,
        summaryKeys: Object.keys(financialSummaryData),
        totalImports: financialSalesHistory.length,
        allImportDates: financialSalesHistory.map(s => ({ 
          date: s.date, 
          month: s.date?.slice(0, 7),
          fileName: s.fileName,
          productCount: Object.keys(s.products || {}).length 
        })),
        selectedMonth: monthYear
      });
      console.log('2. Filtered Sales:', {
        monthImports: monthSales.length,
        monthSalesData: monthSales,
        calculatedRevenue: financialSummary.totalRevenue,
        calculatedUnits: financialSummary.externalSales.units
      });
      console.log('3. Inventory Data:', {
        hasInventory: !!inventoryData.current,
        inventoryProducts: inventoryData.current ? Object.keys(inventoryData.current) : [],
        externalSales: inventoryExternal
      });
      
      setReportData({
        month: monthYear,
        monthName: new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        donorStats,
        financialSummary,
        inventoryExternal,
        isUsingFallback,
        generatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error generating report:', error);
      alert('❌ Error generating report');
    } finally {
      setGenerating(false);
    }
  };
  
  // Export report to CSV/Excel
  const exportReport = async () => {
    if (!reportData) return;
    
    try {
      const csvData = [];
      
      // Header
      csvData.push(['Monthly Report - ' + reportData.monthName]);
      csvData.push(['Generated:', new Date(reportData.generatedAt).toLocaleDateString('en-US')]);
      csvData.push(['']);
      
      // Donor statistics
      csvData.push(['=== Donor Statistics ===']);
      csvData.push(['Total Donors:', reportData.donorStats.totalDonors]);
      csvData.push(['Successful Donations:', reportData.donorStats.totalDonations]);
      csvData.push(['Success Rate:', reportData.donorStats.totalDonors > 0 ? `${Math.round((reportData.donorStats.totalDonations / reportData.donorStats.totalDonors) * 100)}%` : '0%']);
      csvData.push(['Dog Donors:', reportData.donorStats.dogDonors]);
      csvData.push(['Cat Donors:', reportData.donorStats.catDonors]);
      csvData.push(['Private Owners:', reportData.donorStats.privateOwners]);
      csvData.push(['']);
      
      // Financial summary
      csvData.push(['=== Financial Summary ===']);
      csvData.push(['Total Revenue:', `$${reportData.financialSummary.totalRevenue.toLocaleString()}`]);
      csvData.push(['Total Expenses:', `$${reportData.financialSummary.totalExpenses.toLocaleString()}`]);
      csvData.push(['Net Profit:', `$${reportData.financialSummary.netProfit.toLocaleString()}`]);
      csvData.push(['Profit Margin:', reportData.financialSummary.totalRevenue > 0 ? `${Math.round((reportData.financialSummary.netProfit / reportData.financialSummary.totalRevenue) * 100)}%` : '0%']);
      csvData.push(['']);
      
      // External sales
      csvData.push(['=== External Sales ===']);
      csvData.push(['External Revenue:', `$${reportData.financialSummary.externalSales.revenue.toLocaleString()}`]);
      csvData.push(['External Units Sold:', reportData.financialSummary.externalSales.units]);
      csvData.push(['% of Total Revenue:', reportData.financialSummary.totalRevenue > 0 ? `${Math.round((reportData.financialSummary.externalSales.revenue / reportData.financialSummary.totalRevenue) * 100)}%` : '0%']);
      if (reportData.financialSummary.externalSales.units > 0) {
        csvData.push(['Avg Price per Unit:', `$${Math.round(reportData.financialSummary.externalSales.revenue / reportData.financialSummary.externalSales.units)}`]);
      }
      csvData.push(['']);
      
      // External sales by product
      if (Object.keys(reportData.inventoryExternal).length > 0) {
        csvData.push(['=== External Sales by Product ===']);
        csvData.push(['Product', 'Units', '% of External Sales']);
        Object.keys(reportData.inventoryExternal).forEach(productKey => {
          const product = BLOOD_PRODUCTS[productKey];
          const units = reportData.inventoryExternal[productKey];
          const percentage = reportData.financialSummary.externalSales.units > 0 ? 
            Math.round((units / reportData.financialSummary.externalSales.units) * 100) : 0;
          csvData.push([product?.name_en || productKey, units, `${percentage}%`]);
        });
        csvData.push(['']);
      }
      
      const csv = Papa.unparse(csvData);
      const fileName = `monthly_report_${reportData.month.replace('-', '_')}.csv`;
      
      // Create blob and share file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      try {
        // Try to use native share if available
        await Share.share({
          title: 'Monthly Report',
          text: `Monthly report for ${reportData.monthName}`,
          url: url,
          dialogTitle: 'Share Monthly Report'
        });
      } catch (shareError) {
        // Fallback to download for web
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert(`✅ Report downloaded successfully!\nFile: ${fileName}`);
      }
      
      // Clean up
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('❌ Error saving report');
    }
  };
  
  // Print report
  const printReport = () => {
    window.print();
  };
  
  useEffect(() => {
    if (selectedMonth) {
      generateReportData();
    }
  }, [selectedMonth]);

  return (
    <div className={`w-full max-w-7xl mx-auto ${colors.text.primary} p-4`}>
      <div className={`${colors.bg.card} rounded-3xl shadow-2xl p-8 mb-6 border ${colors.border.primary}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 bg-clip-text text-transparent">
              📊 Monthly Report
            </h2>
            <p className={`text-sm ${colors.text.secondary}`}>Comprehensive report of donors, sales and revenue</p>
          </div>
          <div className="flex gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={`px-4 py-2 border-2 ${colors.border.input} rounded-xl ${colors.bg.input} ${colors.text.primary}`}
            />
            <button
              onClick={exportReport}
              disabled={!reportData || generating}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              📄 <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {generating && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
            <p className="text-lg font-semibold">Generating report...</p>
          </div>
        )}

        {reportData && !generating && (
          <div className="space-y-8">
            {/* Fallback Warning */}
            {reportData.isUsingFallback && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <span className="text-xl">⚠️</span>
                  <span className="font-semibold">Note: Using cumulative data</span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  No financial import found for {reportData.monthName}. Showing cumulative financial data from all imports.
                </p>
              </div>
            )}

            {/* Header */}
            <div className="text-center bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-6">
              <h3 className="text-3xl font-bold text-purple-800 dark:text-purple-200 mb-2">
                Report for {reportData.monthName}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generated: {new Date(reportData.generatedAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            {/* Donor Statistics */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h4 className="text-2xl font-bold mb-4 text-blue-800 dark:text-blue-200 flex items-center gap-2">
                🩸 Donor Statistics
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <div className="text-3xl font-bold text-blue-600">{reportData.donorStats.totalDonors}</div>
                  <div className="text-sm text-blue-800 dark:text-blue-300">Total Visits</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                  <div className="text-3xl font-bold text-green-600">{reportData.donorStats.totalDonations}</div>
                  <div className="text-sm text-green-800 dark:text-green-300">Donations</div>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/30 rounded-xl">
                  <div className="text-3xl font-bold text-orange-600">{reportData.donorStats.dogDonors}</div>
                  <div className="text-sm text-orange-800 dark:text-orange-300">Dog Donors</div>
                </div>
                <div className="text-center p-4 bg-pink-50 dark:bg-pink-900/30 rounded-xl">
                  <div className="text-3xl font-bold text-pink-600">{reportData.donorStats.catDonors}</div>
                  <div className="text-sm text-pink-800 dark:text-pink-300">Cat Donors</div>
                </div>
              </div>
              
              {/* Success Rate */}
              <div className="mt-4 text-center p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                <div className="text-2xl font-bold text-purple-600">
                  {reportData.donorStats.totalDonors > 0 ? Math.round((reportData.donorStats.totalDonations / reportData.donorStats.totalDonors) * 100) : 0}%
                </div>
                <div className="text-sm text-purple-800 dark:text-purple-300">Success Rate</div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h4 className="text-2xl font-bold mb-4 text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                💰 Financial Summary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                  <div className="text-2xl font-bold text-green-600">${reportData.financialSummary.totalRevenue.toLocaleString()}</div>
                  <div className="text-sm text-green-800 dark:text-green-300">Total Revenue</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/30 rounded-xl">
                  <div className="text-2xl font-bold text-red-600">${reportData.financialSummary.totalExpenses.toLocaleString()}</div>
                  <div className="text-sm text-red-800 dark:text-red-300">Total Expenses</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <div className={`text-2xl font-bold ${reportData.financialSummary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${reportData.financialSummary.netProfit.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-800 dark:text-blue-300">Net Profit</div>
                </div>
              </div>
            </div>

            {/* Additional Statistics */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h4 className="text-2xl font-bold mb-4 text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
                📈 Additional Statistics
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                  <div className="text-xl font-bold text-indigo-600">
                    {reportData.donorStats.totalDonors > 0 ? Math.round((reportData.donorStats.totalDonations / reportData.donorStats.totalDonors) * 100) : 0}%
                  </div>
                  <div className="text-sm text-indigo-800 dark:text-indigo-300">Overall Success Rate</div>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                  <div className="text-xl font-bold text-amber-600">
                    {Math.round(reportData.financialSummary.totalRevenue / Math.max(reportData.donorStats.totalDonations, 1))}
                  </div>
                  <div className="text-sm text-amber-800 dark:text-amber-300">Avg Revenue per Donation</div>
                </div>
                <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                  <div className="text-xl font-bold text-emerald-600">
                    {reportData.financialSummary.externalSales.units > 0 && reportData.donorStats.totalDonations > 0 ? 
                      Math.round((reportData.financialSummary.externalSales.units / reportData.donorStats.totalDonations) * 10) / 10 : 0}
                  </div>
                  <div className="text-sm text-emerald-800 dark:text-emerald-300">Avg Units per Donation</div>
                </div>
                <div className="text-center p-4 bg-rose-50 dark:bg-rose-900/30 rounded-xl">
                  <div className="text-xl font-bold text-rose-600">
                    {reportData.financialSummary.totalRevenue > 0 ? 
                      Math.round((reportData.financialSummary.externalSales.revenue / reportData.financialSummary.totalRevenue) * 100) : 0}%
                  </div>
                  <div className="text-sm text-rose-800 dark:text-rose-300">External Revenue %</div>
                </div>
              </div>
            </div>

            {/* External Sales */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h4 className="text-2xl font-bold mb-4 text-cyan-800 dark:text-cyan-200 flex items-center gap-2">
                🏥 External Sales
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl">
                    <div className="text-2xl font-bold text-cyan-600">${reportData.financialSummary.externalSales.revenue.toLocaleString()}</div>
                    <div className="text-sm text-cyan-800 dark:text-cyan-300">External Sales Revenue</div>
                  </div>
                  <div className="text-center p-4 bg-teal-50 dark:bg-teal-900/30 rounded-xl">
                    <div className="text-2xl font-bold text-teal-600">{reportData.financialSummary.externalSales.units}</div>
                    <div className="text-sm text-teal-800 dark:text-teal-300">External Units Sold</div>
                  </div>
                </div>
                
                {Object.keys(reportData.inventoryExternal).length > 0 && (
                  <div>
                    <div className="font-semibold mb-3 text-cyan-800 dark:text-cyan-200">Breakdown by Product:</div>
                    <div className="space-y-2">
                      {Object.keys(reportData.inventoryExternal).map(productKey => {
                        const product = BLOOD_PRODUCTS[productKey];
                        const units = reportData.inventoryExternal[productKey];
                        return (
                          <div key={productKey} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-sm font-medium">{product?.name_en || productKey}</span>
                            <span className="text-sm font-bold text-cyan-600">{units} units</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyReport;