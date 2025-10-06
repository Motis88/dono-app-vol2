import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { donorStorage } from '../utils/storage';
import { LOCATIONS } from '../utils/constants';
import Papa from 'papaparse';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
      const donors = donorStorage.getDonors() || [];
      const inventoryData = JSON.parse(localStorage.getItem('blood_inventory') || '{"current": {}, "sales": []}');
      const financialData = JSON.parse(localStorage.getItem('financial_data') || '{"transactions": []}');
      
      const monthYear = selectedMonth; // YYYY-MM
      const [year, month] = monthYear.split('-');
      
      // Filter donors by month
      const monthDonors = donors.filter(donor => {
        if (!donor.date) return false;
        const donorMonth = donor.date.slice(0, 7); // Extract YYYY-MM
        return donorMonth === monthYear;
      });
      
      // Count blood donors by type and location
      const donorStats = {
        total: 0,
        byType: { dog: 0, cat: 0 },
        byLocation: {},
        donated: { total: 0, dog: 0, cat: 0 },
        volume: { total: 0, dog: 0, cat: 0 }
      };
      
      // Ensure LOCATIONS is available
      const locations = LOCATIONS || [];
      locations.forEach(loc => {
        donorStats.byLocation[loc] = { total: 0, donated: 0 };
      });
      
      monthDonors.forEach(donor => {
        donorStats.total++;
        
        if (donor.location && donorStats.byLocation[donor.location]) {
          donorStats.byLocation[donor.location].total++;
        }
        
        const animalType = donor.animalType?.toLowerCase().trim();
        if (animalType === 'כלב' || animalType === 'dog') {
          donorStats.byType.dog++;
          if (donor.donated === 'כן') {
            donorStats.donated.dog++;
            donorStats.donated.total++;
            if (donor.location && donorStats.byLocation[donor.location]) {
              donorStats.byLocation[donor.location].donated++;
            }
            if (donor.volume && !isNaN(parseInt(donor.volume))) {
              donorStats.volume.dog += parseInt(donor.volume);
              donorStats.volume.total += parseInt(donor.volume);
            }
          }
        } else if (animalType === 'חתול' || animalType === 'cat') {
          donorStats.byType.cat++;
          if (donor.donated === 'כן') {
            donorStats.donated.cat++;
            donorStats.donated.total++;
            if (donor.location && donorStats.byLocation[donor.location]) {
              donorStats.byLocation[donor.location].donated++;
            }
            if (donor.volume && !isNaN(parseInt(donor.volume))) {
              donorStats.volume.cat += parseInt(donor.volume);
              donorStats.volume.total += parseInt(donor.volume);
            }
          }
        }
      });
      
      // Filter financial transactions by month
      const monthTransactions = (financialData.transactions || []).filter(transaction => {
        if (!transaction.date) return false;
        const transactionMonth = transaction.date.slice(0, 7);
        return transactionMonth === monthYear;
      });
      
      // Calculate financial summary
      const financialSummary = {
        totalRevenue: 0,
        totalExpenses: 0,
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
      
      monthTransactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount) || 0;
        
        if (transaction.type === 'income') {
          financialSummary.totalRevenue += amount;
          
          if (transaction.category === 'external_sales' || transaction.description?.includes('חיצוני')) {
            financialSummary.externalSales.revenue += amount;
            // Try to extract product info from description
            Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
              const product = BLOOD_PRODUCTS[productKey];
              if (transaction.description?.includes(product.name_he) || transaction.description?.includes(product.code)) {
                if (!financialSummary.externalSales.byProduct[productKey]) {
                  financialSummary.externalSales.byProduct[productKey] = { revenue: 0, units: 0 };
                }
                financialSummary.externalSales.byProduct[productKey].revenue += amount;
              }
            });
          } else {
            financialSummary.internalSales.revenue += amount;
          }
        } else {
          financialSummary.totalExpenses += amount;
        }
      });
      
      financialSummary.netProfit = financialSummary.totalRevenue - financialSummary.totalExpenses;
      
      // Get inventory external sales data for the month
      const inventoryExternal = {};
      if (inventoryData.current) {
        Object.keys(inventoryData.current).forEach(productKey => {
          const product = inventoryData.current[productKey];
          if (product.external && product.external > 0) {
            inventoryExternal[productKey] = product.external;
            financialSummary.externalSales.units += product.external;
          }
        });
      }
      
      setReportData({
        month: monthYear,
        monthName: new Date(year, month - 1).toLocaleDateString('he-IL', { year: 'numeric', month: 'long' }),
        donorStats,
        financialSummary,
        inventoryExternal,
        generatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error generating report:', error);
      alert('❌ שגיאה ביצירת הדוח');
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
      csvData.push(['דוח חודשי - ' + reportData.monthName]);
      csvData.push(['נוצר בתאריך:', new Date(reportData.generatedAt).toLocaleDateString('he-IL')]);
      csvData.push(['']);
      
      // Donor statistics
      csvData.push(['=== סטטיסטיקות תורמים ===']);
      csvData.push(['סה"כ תורמים שהגיעו:', reportData.donorStats.total]);
      csvData.push(['תורמים שתרמו דם:', reportData.donorStats.donated.total]);
      csvData.push(['אחוז תרומה:', reportData.donorStats.total > 0 ? `${Math.round((reportData.donorStats.donated.total / reportData.donorStats.total) * 100)}%` : '0%']);
      csvData.push(['תורמי כלבים:', reportData.donorStats.donated.dog]);
      csvData.push(['תורמי חתולים:', reportData.donorStats.donated.cat]);
      csvData.push(['סה"כ נפח דם (מ"ל):', reportData.donorStats.volume.total]);
      csvData.push(['נפח ממוצע לכלב (מ"ל):', reportData.donorStats.donated.dog > 0 ? Math.round(reportData.donorStats.volume.dog / reportData.donorStats.donated.dog) : 0]);
      csvData.push(['נפח ממוצע לחתול (מ"ל):', reportData.donorStats.donated.cat > 0 ? Math.round(reportData.donorStats.volume.cat / reportData.donorStats.donated.cat) : 0]);
      csvData.push(['']);
      
      // By location
      csvData.push(['=== פילוח לפי מיקום ===']);
      csvData.push(['מיקום', 'סה"כ הגעות', 'תרמו דם', 'אחוז תרומה']);
      Object.keys(reportData.donorStats.byLocation).forEach(location => {
        const stats = reportData.donorStats.byLocation[location];
        if (stats.total > 0) {
          const percentage = stats.total > 0 ? Math.round((stats.donated / stats.total) * 100) : 0;
          csvData.push([location, stats.total, stats.donated, `${percentage}%`]);
        }
      });
      csvData.push(['']);
      
      // Financial summary
      csvData.push(['=== סיכום כספי ===']);
      csvData.push(['סה"כ הכנסות:', `₪${reportData.financialSummary.totalRevenue.toLocaleString()}`]);
      csvData.push(['סה"כ הוצאות:', `₪${reportData.financialSummary.totalExpenses.toLocaleString()}`]);
      csvData.push(['רווח נקי:', `₪${reportData.financialSummary.netProfit.toLocaleString()}`]);
      csvData.push(['מרווח רווח:', reportData.financialSummary.totalRevenue > 0 ? `${Math.round((reportData.financialSummary.netProfit / reportData.financialSummary.totalRevenue) * 100)}%` : '0%']);
      csvData.push(['']);
      
      // External sales
      csvData.push(['=== מכירות חיצוניות ===']);
      csvData.push(['הכנסות ממכירות חיצוניות:', `₪${reportData.financialSummary.externalSales.revenue.toLocaleString()}`]);
      csvData.push(['יחידות שנמכרו חיצונית:', reportData.financialSummary.externalSales.units]);
      csvData.push(['אחוז מהכנסות חיצוניות:', reportData.financialSummary.totalRevenue > 0 ? `${Math.round((reportData.financialSummary.externalSales.revenue / reportData.financialSummary.totalRevenue) * 100)}%` : '0%']);
      if (reportData.financialSummary.externalSales.units > 0) {
        csvData.push(['מחיר ממוצע ליחידה חיצונית:', `₪${Math.round(reportData.financialSummary.externalSales.revenue / reportData.financialSummary.externalSales.units)}`]);
      }
      csvData.push(['']);
      
      // External sales by product
      if (Object.keys(reportData.inventoryExternal).length > 0) {
        csvData.push(['=== פילוח מכירות חיצוניות לפי מוצר ===']);
        csvData.push(['מוצר', 'יחידות', 'אחוז מסה"כ חיצוני']);
        Object.keys(reportData.inventoryExternal).forEach(productKey => {
          const product = BLOOD_PRODUCTS[productKey];
          const units = reportData.inventoryExternal[productKey];
          const percentage = reportData.financialSummary.externalSales.units > 0 ? 
            Math.round((units / reportData.financialSummary.externalSales.units) * 100) : 0;
          csvData.push([product?.name_he || productKey, units, `${percentage}%`]);
        });
        csvData.push(['']);
      }
      
      // Summary ratios
      csvData.push(['=== יחסים ותובנות ===']);
      if (reportData.donorStats.donated.total > 0) {
        csvData.push(['מוצרי דם ממוצע לתורם:', Math.round(reportData.financialSummary.externalSales.units / reportData.donorStats.donated.total * 10) / 10]);
      }
      if (reportData.financialSummary.externalSales.units > 0 && reportData.donorStats.volume.total > 0) {
        csvData.push(['יעילות עיבוד (יחידות לכל 100 מ"ל):', Math.round((reportData.financialSummary.externalSales.units / reportData.donorStats.volume.total) * 100 * 10) / 10]);
      }
      
      const csv = Papa.unparse(csvData);
      const fileName = `דוח_חודשי_${reportData.month.replace('-', '_')}.csv`;
      
      // Save file
      await Filesystem.writeFile({
        path: fileName,
        data: csv,
        directory: Directory.Documents
      });
      
      alert(`✅ הדוח נשמר בהצלחה!\nקובץ: ${fileName}\nמיקום: Documents\n\nהקובץ כולל:\n📊 סטטיסטיקות מפורטות\n💰 ניתוח כספי\n🏥 פירוט מכירות חיצוניות\n📈 יחסים ותובנות`);
      
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('❌ שגיאה בשמירת הדוח');
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
              📊 דוח חודשי רשמי
            </h2>
            <p className={`text-sm ${colors.text.secondary}`}>דוח מקיף של תורמים, מכירות והכנסות</p>
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
              📄 <span className="hidden sm:inline">ייצא לקובץ</span>
            </button>
            <button
              onClick={printReport}
              disabled={!reportData || generating}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              🖨️ <span className="hidden sm:inline">הדפס</span>
            </button>
          </div>
        </div>

        {generating && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
            <p className="text-lg font-semibold">מכין דוח...</p>
          </div>
        )}

        {reportData && !generating && (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-6">
              <h3 className="text-3xl font-bold text-purple-800 dark:text-purple-200 mb-2">
                דוח חודש {reportData.monthName}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                נוצר ב: {new Date(reportData.generatedAt).toLocaleDateString('he-IL', { 
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
                🩸 סטטיסטיקות תורמים
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <div className="text-3xl font-bold text-blue-600">{reportData.donorStats.total}</div>
                  <div className="text-sm text-blue-800 dark:text-blue-300">סה"כ הגעות</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                  <div className="text-3xl font-bold text-green-600">{reportData.donorStats.donated.total}</div>
                  <div className="text-sm text-green-800 dark:text-green-300">תרמו דם</div>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/30 rounded-xl">
                  <div className="text-3xl font-bold text-orange-600">{reportData.donorStats.donated.dog}</div>
                  <div className="text-sm text-orange-800 dark:text-orange-300">תורמי כלבים</div>
                </div>
                <div className="text-center p-4 bg-pink-50 dark:bg-pink-900/30 rounded-xl">
                  <div className="text-3xl font-bold text-pink-600">{reportData.donorStats.donated.cat}</div>
                  <div className="text-sm text-pink-800 dark:text-pink-300">תורמי חתולים</div>
                </div>
              </div>
              
              {/* Volume */}
              <div className="mt-4 text-center p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                <div className="text-2xl font-bold text-purple-600">{reportData.donorStats.volume.total} מ"ל</div>
                <div className="text-sm text-purple-800 dark:text-purple-300">סה"כ נפח דם שנתרם</div>
              </div>
            </div>

            {/* By Location */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h4 className="text-2xl font-bold mb-4 text-green-800 dark:text-green-200 flex items-center gap-2">
                📍 פילוח לפי מיקום
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.keys(reportData.donorStats.byLocation).map(location => {
                  const stats = reportData.donorStats.byLocation[location];
                  if (stats.total === 0) return null;
                  
                  return (
                    <div key={location} className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                      <div className="font-bold text-green-800 dark:text-green-200 mb-2">{location}</div>
                      <div className="text-sm space-y-1">
                        <div>הגעות: <span className="font-semibold">{stats.total}</span></div>
                        <div>תרמו: <span className="font-semibold">{stats.donated}</span></div>
                        <div className="text-xs text-green-600">
                          אחוז תרומה: {stats.total > 0 ? Math.round((stats.donated / stats.total) * 100) : 0}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h4 className="text-2xl font-bold mb-4 text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                💰 סיכום כספי
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                  <div className="text-2xl font-bold text-green-600">₪{reportData.financialSummary.totalRevenue.toLocaleString()}</div>
                  <div className="text-sm text-green-800 dark:text-green-300">סה"כ הכנסות</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/30 rounded-xl">
                  <div className="text-2xl font-bold text-red-600">₪{reportData.financialSummary.totalExpenses.toLocaleString()}</div>
                  <div className="text-sm text-red-800 dark:text-red-300">סה"כ הוצאות</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <div className={`text-2xl font-bold ${reportData.financialSummary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₪{reportData.financialSummary.netProfit.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-800 dark:text-blue-300">רווח נקי</div>
                </div>
              </div>
            </div>

            {/* Additional Statistics */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h4 className="text-2xl font-bold mb-4 text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
                📈 נתונים נוספים
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                  <div className="text-xl font-bold text-indigo-600">
                    {reportData.donorStats.total > 0 ? Math.round((reportData.donorStats.donated.total / reportData.donorStats.total) * 100) : 0}%
                  </div>
                  <div className="text-sm text-indigo-800 dark:text-indigo-300">אחוז תרומה כללי</div>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                  <div className="text-xl font-bold text-amber-600">
                    {reportData.donorStats.donated.total > 0 ? Math.round(reportData.donorStats.volume.total / reportData.donorStats.donated.total) : 0} מ"ל
                  </div>
                  <div className="text-sm text-amber-800 dark:text-amber-300">נפח ממוצע לתורם</div>
                </div>
                <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                  <div className="text-xl font-bold text-emerald-600">
                    {reportData.financialSummary.externalSales.units > 0 && reportData.donorStats.donated.total > 0 ? 
                      Math.round((reportData.financialSummary.externalSales.units / reportData.donorStats.donated.total) * 10) / 10 : 0}
                  </div>
                  <div className="text-sm text-emerald-800 dark:text-emerald-300">יחידות ממוצע לתורם</div>
                </div>
                <div className="text-center p-4 bg-rose-50 dark:bg-rose-900/30 rounded-xl">
                  <div className="text-xl font-bold text-rose-600">
                    {reportData.financialSummary.totalRevenue > 0 ? 
                      Math.round((reportData.financialSummary.externalSales.revenue / reportData.financialSummary.totalRevenue) * 100) : 0}%
                  </div>
                  <div className="text-sm text-rose-800 dark:text-rose-300">אחוז הכנסות חיצוניות</div>
                </div>
              </div>
            </div>

            {/* External Sales */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h4 className="text-2xl font-bold mb-4 text-cyan-800 dark:text-cyan-200 flex items-center gap-2">
                🏥 מכירות חיצוניות
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl">
                    <div className="text-2xl font-bold text-cyan-600">₪{reportData.financialSummary.externalSales.revenue.toLocaleString()}</div>
                    <div className="text-sm text-cyan-800 dark:text-cyan-300">הכנסות ממכירות חיצוניות</div>
                  </div>
                  <div className="text-center p-4 bg-teal-50 dark:bg-teal-900/30 rounded-xl">
                    <div className="text-2xl font-bold text-teal-600">{reportData.financialSummary.externalSales.units}</div>
                    <div className="text-sm text-teal-800 dark:text-teal-300">יחידות שנמכרו חיצונית</div>
                  </div>
                </div>
                
                {Object.keys(reportData.inventoryExternal).length > 0 && (
                  <div>
                    <div className="font-semibold mb-3 text-cyan-800 dark:text-cyan-200">פילוח לפי מוצר:</div>
                    <div className="space-y-2">
                      {Object.keys(reportData.inventoryExternal).map(productKey => {
                        const product = BLOOD_PRODUCTS[productKey];
                        const units = reportData.inventoryExternal[productKey];
                        return (
                          <div key={productKey} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-sm font-medium">{product?.name_he || productKey}</span>
                            <span className="text-sm font-bold text-cyan-600">{units} יחידות</span>
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