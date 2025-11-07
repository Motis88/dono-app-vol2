import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const SETTINGS_STORAGE_KEY = 'financial_settings_v2';
const MANUAL_DATA_KEY = 'financial_manual_data';

const EnhancedFinancialDashboard = ({ salesHistory }) => {
  const { colors } = useTheme();
  
  // Cost parameters
  const [costs, setCosts] = useState({
    cbc: 28,
    bloodType: 70,
    dogBag: 36,
    fivFelv: 60
  });

  // Bonus configuration
  const [bonusTiers, setBonusTiers] = useState({
    tier1Threshold: 12,
    tier1Rate: 10,
    tier2Threshold: 31,
    tier2Rate: 30
  });

  // Monthly data from donor database
  const [monthsData, setMonthsData] = useState([]);
  
  // Manual monthly data (shifts & external units per month)
  const [manualData, setManualData] = useState({});
  // { '2025-07': { shifts: 10, externalUnits: 5 }, ... }
  
  // Bonus calculator
  const [externalUnits, setExternalUnits] = useState(0);
  
  // UI state for manual entry
  const [showManualEntry, setShowManualEntry] = useState(false);

  useEffect(() => {
    loadSettings();
    loadManualData();
  }, []);

  useEffect(() => {
    // Recompute months whenever salesHistory changes
    loadMonthlyData();
  }, [salesHistory, manualData]); // Re-run when manual data changes

  const loadSettings = () => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.costs) setCosts(parsed.costs);
        if (parsed.bonusTiers) setBonusTiers(parsed.bonusTiers);
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }
  };
  
  const loadManualData = () => {
    const saved = localStorage.getItem(MANUAL_DATA_KEY);
    if (saved) {
      try {
        setManualData(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading manual data:', e);
      }
    }
  };
  
  const saveManualData = (monthKey, field, value) => {
    const updated = {
      ...manualData,
      [monthKey]: {
        ...manualData[monthKey],
        [field]: parseInt(value) || 0
      }
    };
    setManualData(updated);
    localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(updated));
    toast.success(`✅ ${field} updated for ${monthKey}`);
  };

  const saveSettings = () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      costs,
      bonusTiers,
      lastUpdated: new Date().toISOString()
    }));
    toast.success('✅ Settings saved');
  };

  const loadMonthlyData = () => {
    try {
      // Get donor data for shifts count - CORRECT KEY
      const donorData = localStorage.getItem('animal_donors');
      const donors = donorData ? JSON.parse(donorData) : [];
      
      // Get external cells data - CORRECT KEY
      const externalCellsData = localStorage.getItem('external_cells_data');
      const externalCells = externalCellsData ? JSON.parse(externalCellsData) : {};
      
      // Get inventory data for archives (if any)
      const inventoryJson = localStorage.getItem('blood_inventory');
      const inventoryData = inventoryJson ? JSON.parse(inventoryJson) : null;
      const archives = inventoryData?.archives || [];
      
      // Use salesHistory prop if provided, else fallback to storage
      let salesHistoryEffective = salesHistory && salesHistory.length ? salesHistory : [];
      if (!salesHistoryEffective.length) {
        // Fallback to monthly_sales in localStorage (used by FinancialTracker)
        const monthlySalesJson = localStorage.getItem('monthly_sales');
        salesHistoryEffective = monthlySalesJson ? JSON.parse(monthlySalesJson) : [];
      }
      
      // Build monthly summary combining donor + inventory + financial data
      const monthlyMap = {};
      
      // First pass: count animals checked per day+location to identify real shifts
      const dayLocationCounts = {}; // { 'YYYY-MM-DD_Location': count }
      donors.forEach(donor => {
        if (!donor.date || !donor.location) return;
        const dayLocationKey = `${donor.date}_${donor.location}`;
        dayLocationCounts[dayLocationKey] = (dayLocationCounts[dayLocationKey] || 0) + 1;
      });
      
      // Determine which day+location combinations are real shifts (2+ animals checked)
      const realShifts = new Set();
      Object.entries(dayLocationCounts).forEach(([key, count]) => {
        if (count >= 2) { // At least 2 animals checked = real shift
          realShifts.add(key);
        }
      });
      
      // Process donor data to get shifts and donations
      let donorMonthsFound = new Set();
      donors.forEach(donor => {
        if (!donor.date || !donor.location) return;
        
        const monthKey = donor.date.slice(0, 7); // YYYY-MM
        const dayLocationKey = `${donor.date}_${donor.location}`;
        donorMonthsFound.add(monthKey);
        
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
            shifts: new Set(),
            donations: 0,
            cbcDogs: 0,
            cbcCats: 0,
            bloodTypes: 0,
            dogBags: 0,
            fivFelv: 0,
            externalUnits: 0,
            externalGross: 0
          };
        }
        
        // Track only REAL shifts (2+ animals checked on same day+location)
        if (realShifts.has(dayLocationKey)) {
          monthlyMap[monthKey].shifts.add(dayLocationKey);
        }
        
        // Count donations
        if (donor.donated?.toLowerCase() === 'yes' || donor.donated?.toLowerCase() === 'כן') {
          monthlyMap[monthKey].donations++;
          
          // Count by animal type
          const animalType = donor.animalType?.toLowerCase();
          if (animalType === 'dog' || animalType === 'כלב') {
            monthlyMap[monthKey].cbcDogs++;
            monthlyMap[monthKey].dogBags++;
          } else if (animalType === 'cat' || animalType === 'חתול') {
            monthlyMap[monthKey].cbcCats++;
            monthlyMap[monthKey].fivFelv++;
          }
          
          // Blood type test for all
          if (donor.bloodType) {
            monthlyMap[monthKey].bloodTypes++;
          }
        }
      });
      
      // Add external cells data (manual entry from ExternalCells component)
      Object.keys(externalCells).forEach(monthKey => {
        const cellData = externalCells[monthKey];
        
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
            shifts: new Set(),
            donations: 0,
            cbcDogs: 0,
            cbcCats: 0,
            bloodTypes: 0,
            dogBags: 0,
            fivFelv: 0,
            externalUnits: 0,
            externalGross: 0
          };
        }
        
        // Sum external units from all product types
        let totalExternal = 0;
        if (cellData.wholeBloodCat) totalExternal += parseInt(cellData.wholeBloodCat) || 0;
        if (cellData.wholeBloodDog) totalExternal += parseInt(cellData.wholeBloodDog) || 0;
        if (cellData.plasmaCat) totalExternal += parseInt(cellData.plasmaCat) || 0;
        if (cellData.plasmaDog) totalExternal += parseInt(cellData.plasmaDog) || 0;
        if (cellData.pcCat) totalExternal += parseInt(cellData.pcCat) || 0;
        if (cellData.pcDog) totalExternal += parseInt(cellData.pcDog) || 0;
        
        monthlyMap[monthKey].externalUnits = totalExternal;
        monthlyMap[monthKey].externalGross = totalExternal * 1500; // ₪1,500 per unit estimate
      });
      
      // Add external sales from inventory archives (if any exist)
      archives.forEach(archive => {
        const monthKey = archive.month; // Already in YYYY-MM format
        
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
            shifts: new Set(),
            donations: 0,
            cbcDogs: 0,
            cbcCats: 0,
            bloodTypes: 0,
            dogBags: 0,
            fivFelv: 0,
            externalUnits: 0,
            externalGross: 0
          };
        }
        
        // Count external units
        if (archive.totalExternal) {
          Object.values(archive.totalExternal).forEach(count => {
            monthlyMap[monthKey].externalUnits += count;
          });
        }
        
        // Estimate external revenue (₪1,500 per unit average)
        monthlyMap[monthKey].externalGross = monthlyMap[monthKey].externalUnits * 1500;
      });
      
      // Add financial sales data for actual revenue
      salesHistoryEffective.forEach(sale => {
        if (!sale.date) return;
        
        // Use explicit monthKey if available, otherwise parse from date
        let monthKey = sale.monthKey; // Prefer explicit monthKey from import
        
        if (!monthKey) {
          // Fallback: Parse month from date string
          const dateStr = sale.date.toString();
          if (dateStr.includes('-')) {
            monthKey = dateStr.substring(0, 7); // Extract YYYY-MM directly
          } else {
            const saleDate = new Date(sale.date);
            monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
          }
        }
        
        // Initialize month entry if doesn't exist
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
            shifts: new Set(),
            donations: 0,
            cbcDogs: 0,
            cbcCats: 0,
            bloodTypes: 0,
            dogBags: 0,
            fivFelv: 0,
            externalUnits: 0,
            externalGross: 0,
            grossRevenue: 0,
            unitsSold: 0
          };
        }
        
        // Calculate actual revenue from sales
        if (sale.products) {
          let monthRevenue = 0;
          let monthUnits = 0;
          
          Object.values(sale.products).forEach(product => {
            monthRevenue += (product.revenueIncl || 0);
            monthUnits += (product.quantity || 0);
          });
          
          monthlyMap[monthKey].grossRevenue = (monthlyMap[monthKey].grossRevenue || 0) + monthRevenue;
          monthlyMap[monthKey].unitsSold = (monthlyMap[monthKey].unitsSold || 0) + monthUnits;
        }
      });
      
      // Apply manual data overrides (shifts & external units entered by user)
      Object.keys(manualData).forEach(monthKey => {
        const manual = manualData[monthKey];
        
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
            shifts: new Set(),
            donations: 0,
            cbcDogs: 0,
            cbcCats: 0,
            bloodTypes: 0,
            dogBags: 0,
            fivFelv: 0,
            externalUnits: 0,
            externalGross: 0,
            grossRevenue: 0,
            unitsSold: 0
          };
        }
        
        // Override shifts if manually set
        if (manual.shifts !== undefined && manual.shifts > 0) {
          // Clear auto-detected shifts and set manual count
          monthlyMap[monthKey].manualShifts = manual.shifts;
        }
        
        // Override/add external units if manually set
        if (manual.externalUnits !== undefined && manual.externalUnits > 0) {
          monthlyMap[monthKey].externalUnits = manual.externalUnits;
          monthlyMap[monthKey].externalGross = manual.externalUnits * 1500;
        }
      });
      
      // Convert to array and sort by month (newest first)
      const monthsArray = Object.values(monthlyMap)
        .map(m => {
          // Check if this is the current incomplete month
          const today = new Date();
          const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          const isCurrentMonth = m.month === currentMonth;
          
          return {
            ...m,
            // Use manual shifts if set, otherwise use auto-detected
            shifts: m.manualShifts !== undefined ? m.manualShifts : m.shifts.size,
            // Salary based on shifts (configurable)
            minSalary: (m.manualShifts !== undefined ? m.manualShifts : m.shifts.size) * 2000,
            maxSalary: (m.manualShifts !== undefined ? m.manualShifts : m.shifts.size) * 2640,
            avgSalary: (m.manualShifts !== undefined ? m.manualShifts : m.shifts.size) * 2320,
            // For current incomplete month: only use actual data, don't estimate
            // For past months: use actual revenue if available, otherwise estimate
            grossRevenue: isCurrentMonth ? (m.grossRevenue || 0) : (m.grossRevenue || (m.donations * 1200)),
            unitsSold: isCurrentMonth ? (m.unitsSold || 0) : (m.unitsSold || m.donations)
          };
        })
        .filter(m => m.month >= '2025-07') // Only show from July 2025 onwards
        .sort((a, b) => b.month.localeCompare(a.month));
      
      setMonthsData(monthsArray);
      
    } catch (error) {
      console.error('Error loading monthly data:', error);
      toast.error('Failed to load monthly data');
    }
  };

  const calculateMonthMetrics = (month) => {
    const cbcCost = (month.cbcDogs + month.cbcCats) * costs.cbc;
    const bloodTypeCost = month.bloodTypes * costs.bloodType;
    const dogBagCost = month.dogBags * costs.dogBag;
    const fivFelvCost = month.fivFelv * costs.fivFelv;
    const totalEquipment = cbcCost + bloodTypeCost + dogBagCost + fivFelvCost;
    const totalExpenses = totalEquipment + month.avgSalary;
    const netRevenue = month.grossRevenue - totalExpenses;
    const profitMargin = month.grossRevenue > 0 ? (netRevenue / month.grossRevenue) * 100 : 0;
    const profitRatio = month.grossRevenue > 0 ? netRevenue / month.grossRevenue : 0;
    const calculatedExternalNet = month.externalGross * profitRatio;

    return {
      cbcCost,
      bloodTypeCost,
      dogBagCost,
      fivFelvCost,
      totalEquipment,
      totalExpenses,
      netRevenue,
      profitMargin,
      calculatedExternalNet
    };
  };

  const calculatedMonths = monthsData.map(month => ({
    ...month,
    ...calculateMonthMetrics(month)
  }));

  // Filter out incomplete/zero-revenue months for averages calculation
  const completedMonths = calculatedMonths.filter(m => m.grossRevenue > 0);
  
  const averages = completedMonths.length > 0 ? {
    grossRevenue: completedMonths.reduce((sum, m) => sum + m.grossRevenue, 0) / completedMonths.length,
    netRevenue: completedMonths.reduce((sum, m) => sum + m.netRevenue, 0) / completedMonths.length,
    // Calculate profit margin from totals, not average of percentages
    profitMargin: (() => {
      const totalGross = completedMonths.reduce((sum, m) => sum + m.grossRevenue, 0);
      const totalNet = completedMonths.reduce((sum, m) => sum + m.netRevenue, 0);
      return totalGross > 0 ? (totalNet / totalGross) * 100 : 0;
    })(),
    unitsSold: completedMonths.reduce((sum, m) => sum + m.unitsSold, 0) / completedMonths.length,
    externalUnits: completedMonths.reduce((sum, m) => sum + m.externalUnits, 0) / completedMonths.length,
    externalGross: completedMonths.reduce((sum, m) => sum + m.externalGross, 0) / completedMonths.length,
    externalNet: completedMonths.reduce((sum, m) => sum + m.calculatedExternalNet, 0) / completedMonths.length,
    revenuePerUnit: completedMonths.reduce((sum, m) => sum + m.grossRevenue, 0) / completedMonths.reduce((sum, m) => sum + m.unitsSold, 0) || 0,
    netPerUnit: completedMonths.reduce((sum, m) => sum + m.netRevenue, 0) / completedMonths.reduce((sum, m) => sum + m.unitsSold, 0) || 0
  } : {
    grossRevenue: 0, netRevenue: 0, profitMargin: 0, unitsSold: 0,
    externalUnits: 0, externalGross: 0, externalNet: 0, revenuePerUnit: 0, netPerUnit: 0
  };

  const netPerUnitForBonus = averages.externalUnits > 0 ? averages.externalNet / averages.externalUnits : 0;

  const handleCostChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    setCosts(prev => ({ ...prev, [field]: numValue }));
  };

  const handleBonusTierChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    setBonusTiers(prev => ({ ...prev, [field]: numValue }));
  };

  const formatCurrency = (num) => `₪${Math.round(num).toLocaleString('en-US')}`;
  const formatPercent = (num) => `${num.toFixed(1)}%`;
  const formatMonth = (monthKey) => {
    if (!monthKey) return '???';
    // Remove any stray whitespace
    const clean = monthKey.trim();
    // Expect pattern YYYY-MM
    const parts = clean.split('-');
    if (parts.length !== 2) return clean;
    const [year, month] = parts;
    if (!/^[0-9]{4}$/.test(year) || !/^[0-9]{2}$/.test(month)) return clean;
    switch (month) {
      case '01': return `Jan '${year.slice(2)}`;
      case '02': return `Feb '${year.slice(2)}`;
      case '03': return `Mar '${year.slice(2)}`;
      case '04': return `Apr '${year.slice(2)}`;
      case '05': return `May '${year.slice(2)}`;
      case '06': return `Jun '${year.slice(2)}`;
      case '07': return `Jul '${year.slice(2)}`;
      case '08': return `Aug '${year.slice(2)}`;
      case '09': return `Sep '${year.slice(2)}`;
      case '10': return `Oct '${year.slice(2)}`;
      case '11': return `Nov '${year.slice(2)}`;
      case '12': return `Dec '${year.slice(2)}`;
      default: return clean;
    }
  };

  const calculateBonus = (units) => {
    const baseAmount = netPerUnitForBonus * units;
    let bonusRate = 0;
    let tier = '';

    if (units >= bonusTiers.tier2Threshold) {
      bonusRate = bonusTiers.tier2Rate / 100;
      tier = `${bonusTiers.tier2Threshold}+`;
    } else if (units >= bonusTiers.tier1Threshold) {
      bonusRate = bonusTiers.tier1Rate / 100;
      tier = `${bonusTiers.tier1Threshold}-${bonusTiers.tier2Threshold - 1}`;
    } else {
      bonusRate = 0;
      tier = `0-${bonusTiers.tier1Threshold - 1}`;
    }

    const bonusAmount = baseAmount * bonusRate;
    const employerNet = baseAmount - bonusAmount;

    return {
      baseAmount,
      bonusRate,
      bonusAmount,
      employerNet,
      tier
    };
  };

  const bonusResult = calculateBonus(externalUnits);

  return (
    <div className={`min-h-screen ${colors.bg.primary} p-4 md:p-8`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className={`${colors.bg.card} rounded-2xl shadow-lg p-6 md:p-8 ${colors.border.primary} border`}>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            💰 Financial Dashboard
          </h1>
          <p className={`${colors.text.secondary}`}>Comprehensive financial tracking and bonus calculator</p>
        </div>

        {/* Cost Parameters */}
        <div className={`${colors.bg.card} rounded-2xl shadow-lg p-6 md:p-8 ${colors.border.primary} border`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className={`text-2xl font-bold ${colors.text.primary}`}>💰 Cost Parameters</h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                className="flex-1 md:flex-none bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 shadow-md transition-all duration-200 text-center"
              >
                ✏️ Manual Data
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 md:flex-none bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 shadow-md transition-all duration-200 text-center"
              >
                💾 Save
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>CBC Test</label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.text.secondary}`}>₪</span>
                <input
                  type="number"
                  value={costs.cbc}
                  onChange={(e) => handleCostChange('cbc', e.target.value)}
                  className={`w-full pl-8 pr-4 py-3 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                />
              </div>
            </div>
            <div>
              <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>Blood Type</label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.text.secondary}`}>₪</span>
                <input
                  type="number"
                  value={costs.bloodType}
                  onChange={(e) => handleCostChange('bloodType', e.target.value)}
                  className={`w-full pl-8 pr-4 py-3 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                />
              </div>
            </div>
            <div>
              <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>Dog Bag</label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.text.secondary}`}>₪</span>
                <input
                  type="number"
                  value={costs.dogBag}
                  onChange={(e) => handleCostChange('dogBag', e.target.value)}
                  className={`w-full pl-8 pr-4 py-3 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                />
              </div>
            </div>
            <div>
              <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>FIV/FELV</label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.text.secondary}`}>₪</span>
                <input
                  type="number"
                  value={costs.fivFelv}
                  onChange={(e) => handleCostChange('fivFelv', e.target.value)}
                  className={`w-full pl-8 pr-4 py-3 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">💵</span>
              <h3 className="text-sm font-semibold opacity-90">Avg Gross Revenue</h3>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(averages.grossRevenue)}</p>
            <p className="text-sm opacity-75 mt-1">{formatCurrency(averages.revenuePerUnit)} per unit</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📈</span>
              <h3 className="text-sm font-semibold opacity-90">Avg Net Revenue</h3>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(averages.netRevenue)}</p>
            <p className="text-sm opacity-75 mt-1">{formatCurrency(averages.netPerUnit)} per unit</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📊</span>
              <h3 className="text-sm font-semibold opacity-90">Avg Profit Margin</h3>
            </div>
            <p className="text-3xl font-bold">{formatPercent(averages.profitMargin)}</p>
            <p className="text-sm opacity-75 mt-1">{averages.unitsSold.toFixed(1)} units/month</p>
          </div>
        </div>

        {/* Monthly Summary Table */}
        {calculatedMonths.length > 0 && (
          <div className={`${colors.bg.card} rounded-2xl shadow-lg overflow-hidden ${colors.border.primary} border`}>
            <div className="p-4 md:p-6">
              <h2 className={`text-2xl font-bold ${colors.text.primary} mb-4`}>📅 Monthly Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={`${colors.bg.secondary}`}>
                  <tr>
                    <th className={`px-3 md:px-6 py-3 text-left text-xs font-semibold ${colors.text.primary}`}>Month</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Shifts</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Donations</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Equipment</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Salary</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Expenses</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Gross</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Net</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Profit%</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedMonths.map((month, idx) => (
                    <tr key={idx} className={`${colors.border.primary} border-b hover:${colors.bg.tertiary} transition-colors`}>
                      <td className={`px-3 md:px-6 py-3 font-semibold ${colors.text.primary}`}>
                        <div className="flex flex-col">
                          <span>{formatMonth(month.month)}</span>
                          <span className="text-xs opacity-60">{month.month}</span>
                        </div>
                      </td>
                      <td className={`px-3 md:px-6 py-3 text-right ${colors.text.secondary}`}>{month.shifts}</td>
                      <td className={`px-3 md:px-6 py-3 text-right ${colors.text.secondary}`}>{month.donations}</td>
                      <td className={`px-3 md:px-6 py-3 text-right ${colors.text.secondary}`}>{formatCurrency(month.totalEquipment)}</td>
                      <td className={`px-3 md:px-6 py-3 text-right ${colors.text.secondary}`}>{formatCurrency(month.avgSalary)}</td>
                      <td className={`px-3 md:px-6 py-3 text-right font-semibold text-red-600`}>{formatCurrency(month.totalExpenses)}</td>
                      <td className={`px-3 md:px-6 py-3 text-right font-semibold text-blue-600`}>{formatCurrency(month.grossRevenue)}</td>
                      <td className={`px-3 md:px-6 py-3 text-right font-bold text-green-600`}>{formatCurrency(month.netRevenue)}</td>
                      <td className={`px-3 md:px-6 py-3 text-right font-bold text-purple-600`}>{formatPercent(month.profitMargin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* External Sales + Bonus in two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* External Sales */}
          {calculatedMonths.some(m => m.externalUnits > 0) && (
            <div className={`${colors.bg.card} rounded-2xl shadow-lg p-6 ${colors.border.primary} border`}>
              <h2 className={`text-xl font-bold ${colors.text.primary} mb-4`}>🏥 External Sales</h2>
              <div className="space-y-3">
                {calculatedMonths.filter(m => m.externalUnits > 0).slice(0, 6).map((month, idx) => (
                  <div key={idx} className={`flex justify-between items-center p-3 ${colors.bg.tertiary} rounded-lg`}>
                    <div>
                      <div className={`font-semibold ${colors.text.primary}`}>{formatMonth(month.month)}</div>
                      <div className={`text-sm ${colors.text.secondary}`}>{month.externalUnits} units</div>
                    </div>
                    <div className="text-right">
                      <div className="text-blue-600 font-bold">{formatCurrency(month.externalGross)}</div>
                      <div className="text-green-600 text-sm">{formatCurrency(month.calculatedExternalNet)} net</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bonus Calculator */}
          <div className={`${colors.bg.card} rounded-2xl shadow-lg p-6 ${colors.border.primary} border`}>
            <h2 className={`text-xl font-bold ${colors.text.primary} mb-4`}>🧮 Bonus Calculator</h2>
            
            <div className="mb-4">
              <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                External Units
              </label>
              <input
                type="number"
                min="0"
                value={externalUnits}
                onChange={(e) => setExternalUnits(parseInt(e.target.value) || 0)}
                className={`w-full px-4 py-3 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-lg ${colors.bg.primary} ${colors.text.primary}`}
                placeholder="Enter units..."
              />
            </div>

            <div className={`${colors.bg.tertiary} rounded-lg p-4 mb-4`}>
              <div className={`text-sm ${colors.text.secondary} mb-1`}>Current Tier</div>
              <div className={`text-2xl font-bold ${
                externalUnits >= bonusTiers.tier2Threshold ? 'text-green-600' :
                externalUnits >= bonusTiers.tier1Threshold ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {bonusResult.tier} units ({(bonusResult.bonusRate * 100).toFixed(0)}%)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={`${colors.bg.tertiary} rounded-lg p-3`}>
                <div className={`text-xs ${colors.text.secondary} mb-1`}>Base Amount</div>
                <div className="text-lg font-bold text-blue-600">{formatCurrency(bonusResult.baseAmount)}</div>
              </div>
              <div className={`${colors.bg.tertiary} rounded-lg p-3`}>
                <div className={`text-xs ${colors.text.secondary} mb-1`}>My Bonus</div>
                <div className="text-lg font-bold text-orange-600">{formatCurrency(bonusResult.bonusAmount)}</div>
              </div>
            </div>

            {/* Bonus Tiers */}
            <div className="mt-4 space-y-2">
              <div className="text-sm font-semibold ${colors.text.primary}">Bonus Tiers:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="number"
                  value={bonusTiers.tier1Threshold}
                  onChange={(e) => handleBonusTierChange('tier1Threshold', e.target.value)}
                  className={`px-2 py-1 border ${colors.border.primary} rounded ${colors.bg.primary} ${colors.text.primary}`}
                  placeholder="Tier 1"
                />
                <input
                  type="number"
                  value={bonusTiers.tier1Rate}
                  onChange={(e) => handleBonusTierChange('tier1Rate', e.target.value)}
                  className={`px-2 py-1 border ${colors.border.primary} rounded ${colors.bg.primary} ${colors.text.primary}`}
                  placeholder="%"
                />
                <input
                  type="number"
                  value={bonusTiers.tier2Threshold}
                  onChange={(e) => handleBonusTierChange('tier2Threshold', e.target.value)}
                  className={`px-2 py-1 border ${colors.border.primary} rounded ${colors.bg.primary} ${colors.text.primary}`}
                  placeholder="Tier 2"
                />
                <input
                  type="number"
                  value={bonusTiers.tier2Rate}
                  onChange={(e) => handleBonusTierChange('tier2Rate', e.target.value)}
                  className={`px-2 py-1 border ${colors.border.primary} rounded ${colors.bg.primary} ${colors.text.primary}`}
                  placeholder="%"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <button
            onClick={loadMonthlyData}
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>
      
      {/* Manual Data Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowManualEntry(false)}>
          <div className={`${colors.bg.card} rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${colors.text.primary}`}>✏️ Manual Data Entry</h2>
                <button
                  onClick={() => setShowManualEntry(false)}
                  className={`text-2xl ${colors.text.secondary} hover:text-red-500 transition-colors`}
                >
                  ✕
                </button>
              </div>
              
              <p className={`${colors.text.secondary} mb-6`}>
                Enter shifts and external units manually for each month. This data will override auto-detected values.
              </p>
              
              <div className="space-y-4">
                {calculatedMonths.map((month) => (
                  <div key={month.month} className={`${colors.bg.secondary} p-4 rounded-lg border ${colors.border.primary}`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                      {/* Month Label */}
                      <div className="md:col-span-1">
                        <div className={`font-bold text-lg ${colors.text.primary}`}>{formatMonth(month.month)}</div>
                        <div className={`text-sm ${colors.text.secondary}`}>{month.month}</div>
                      </div>
                      
                      {/* Input Fields */}
                      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                            Shifts
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={manualData[month.month]?.shifts || ''}
                            onChange={(e) => saveManualData(month.month, 'shifts', e.target.value)}
                            placeholder={`Current: ${month.shifts}`}
                            className={`w-full px-3 py-2 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                          />
                          <div className={`text-xs ${colors.text.secondary} mt-1`}>Auto-detected: {month.shifts}</div>
                        </div>
                        
                        <div>
                          <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                            External Units
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={manualData[month.month]?.externalUnits || ''}
                            onChange={(e) => saveManualData(month.month, 'externalUnits', e.target.value)}
                            placeholder={`Current: ${month.externalUnits}`}
                            className={`w-full px-3 py-2 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                          />
                          <div className={`text-xs ${colors.text.secondary} mt-1`}>Auto-detected: {month.externalUnits}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 shadow-md transition-all duration-200"
                >
                  ✅ Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedFinancialDashboard;
