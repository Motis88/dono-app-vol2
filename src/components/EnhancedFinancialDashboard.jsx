import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const SETTINGS_STORAGE_KEY = 'financial_settings_v2';

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
  
  // Bonus calculator
  const [externalUnits, setExternalUnits] = useState(0);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    // Recompute months whenever salesHistory changes
    loadMonthlyData();
  }, [salesHistory]);

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
      // Get donor data for shifts count
      const donorData = localStorage.getItem('donors');
      const donors = donorData ? JSON.parse(donorData) : [];
      
      // Get inventory data for external sales
      const inventoryJson = localStorage.getItem('blood_inventory');
      const inventoryData = inventoryJson ? JSON.parse(inventoryJson) : null;
      const archives = inventoryData?.archives || [];
      
      // Use salesHistory prop if provided, else fallback to storage
      let salesHistoryEffective = salesHistory && salesHistory.length ? salesHistory : [];
      if (!salesHistoryEffective.length) {
        const financialJson = localStorage.getItem('financial_data');
        const financialData = financialJson ? JSON.parse(financialJson) : null;
        salesHistoryEffective = financialData?.sales || [];
      }
      
      console.log('=== Financial Data Debug ===');
      console.log('Total sales records:', salesHistory.length);
      salesHistory.slice(0, 5).forEach((sale, idx) => {
        console.log(`Sale ${idx + 1}:`, {
          date: sale.date,
          fileName: sale.fileName,
          productsCount: Object.keys(sale.products || {}).length
        });
      });
      
      // Build monthly summary combining donor + inventory + financial data
      const monthlyMap = {};
      
      // Process donor data to get shifts and donations
      donors.forEach(donor => {
        if (!donor.date || !donor.location) return;
        
        const monthKey = donor.date.slice(0, 7); // YYYY-MM
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
        
        // Track unique shifts
        monthlyMap[monthKey].shifts.add(`${donor.date}_${donor.location}`);
        
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
      
      // Add external sales from inventory archives
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
        
        // Parse month directly from date string to avoid timezone issues
        const dateStr = sale.date.toString();
        let monthKey;
        
        // If date is in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
        if (dateStr.includes('-')) {
          monthKey = dateStr.substring(0, 7); // Extract YYYY-MM directly
        } else {
          // Fallback to Date parsing
          const saleDate = new Date(sale.date);
          monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
        }
        
        console.log('Processing sale:', {
          originalDate: sale.date,
          dateStr: dateStr,
          extractedMonthKey: monthKey,
          fileName: sale.fileName
        });
        
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
      
      // Convert to array and sort by month (newest first)
  console.log('=== Monthly Map Keys (raw) ===', Object.keys(monthlyMap));
      const monthsArray = Object.values(monthlyMap).map(m => ({
        ...m,
        shifts: m.shifts.size, // Convert Set to count
        // Salary based on shifts (configurable)
        minSalary: m.shifts * 2000,
        maxSalary: m.shifts * 2640,
        avgSalary: m.shifts * 2320,
        // Use actual revenue if available, otherwise estimate
        grossRevenue: m.grossRevenue || (m.donations * 1200),
        unitsSold: m.unitsSold || m.donations
      })).sort((a, b) => b.month.localeCompare(a.month));
      
      console.log('=== Final Months Array (pre-format) ===');
      monthsArray.forEach(m => {
        console.log('Month entry raw:', m.month, 'formatted:', formatMonth(m.month));
      });
      
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

  // Debug render logging
  try {
    console.log('Render calculatedMonths order:', calculatedMonths.map(m => m.month));
  } catch (e) {}

  const averages = calculatedMonths.length > 0 ? {
    grossRevenue: calculatedMonths.reduce((sum, m) => sum + m.grossRevenue, 0) / calculatedMonths.length,
    netRevenue: calculatedMonths.reduce((sum, m) => sum + m.netRevenue, 0) / calculatedMonths.length,
    profitMargin: calculatedMonths.reduce((sum, m) => sum + m.profitMargin, 0) / calculatedMonths.length,
    unitsSold: calculatedMonths.reduce((sum, m) => sum + m.unitsSold, 0) / calculatedMonths.length,
    externalUnits: calculatedMonths.reduce((sum, m) => sum + m.externalUnits, 0) / calculatedMonths.length,
    externalGross: calculatedMonths.reduce((sum, m) => sum + m.externalGross, 0) / calculatedMonths.length,
    externalNet: calculatedMonths.reduce((sum, m) => sum + m.calculatedExternalNet, 0) / calculatedMonths.length,
    revenuePerUnit: calculatedMonths.reduce((sum, m) => sum + m.grossRevenue, 0) / calculatedMonths.reduce((sum, m) => sum + m.unitsSold, 0) || 0,
    netPerUnit: calculatedMonths.reduce((sum, m) => sum + m.netRevenue, 0) / calculatedMonths.reduce((sum, m) => sum + m.unitsSold, 0) || 0
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
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl font-bold ${colors.text.primary}`}>💰 Cost Parameters</h2>
            <button
              onClick={saveSettings}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 shadow-md transition-all duration-200"
            >
              💾 Save
            </button>
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
    </div>
  );
};

export default EnhancedFinancialDashboard;
