import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const SETTINGS_STORAGE_KEY = 'financial_settings_v2';
const MANUAL_DATA_KEY = 'financial_manual_data';

const EnhancedFinancialDashboard = ({ salesHistory }) => {
  const { colors } = useTheme();
  
  // Cost parameters
  const [costs, setCosts] = useState({
    cbc: 30,
    COMITbloodType: 70,
    dogBag: 36,
    fivFelv: 70
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
  // UI state for collapsible sections
  const [showCostParams, setShowCostParams] = useState(false);
  const [showBonusCalc, setShowBonusCalc] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);

  useEffect(() => {
    loadSettings();
    loadManualData();
    loadMonthlyData(); // Initial load
  }, []);

  useEffect(() => {
    // Recompute months whenever salesHistory or manualData changes
    loadMonthlyData();
  }, [salesHistory, manualData]);

  // Listen for changes to donor data in localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'animal_donors' || e.key === 'external_cells_data') {
        loadMonthlyData();
      }
    };

    // Listen to storage events from other tabs/windows
    window.addEventListener('storage', handleStorageChange);

    // Also refresh periodically to catch same-tab changes
    const interval = setInterval(() => {
      loadMonthlyData();
    }, 2000); // Refresh every 2 seconds

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [manualData])

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
        
        const animalType = donor.animalType?.toLowerCase();
        const isDog = animalType === 'dog' || animalType === 'כלב';
        const isCat = animalType === 'cat' || animalType === 'חתול';
        
        // 1. CBC - count if ANY of HTC/WBC/PLT has a numeric value
        const hasCBC = (donor.hct && !isNaN(parseFloat(donor.hct))) ||
                       (donor.wbc && !isNaN(parseFloat(donor.wbc))) ||
                       (donor.plt && !isNaN(parseFloat(donor.plt)));
        
        if (hasCBC) {
          if (isDog) {
            monthlyMap[monthKey].cbcDogs++;
          } else if (isCat) {
            monthlyMap[monthKey].cbcCats++;
          }
        }
        
        // Count actual donations first
        const donated = donor.donated?.toLowerCase() === 'yes' || donor.donated?.toLowerCase() === 'כן';
        
        if (donated) {
          monthlyMap[monthKey].donations++;
          
          // 2. Blood Type - every donor gets blood type test
          monthlyMap[monthKey].bloodTypes++;
          
          // 3. Dog Bags - only for dogs that donated
          if (isDog) {
            monthlyMap[monthKey].dogBags++;
          }
          
          // 4. FIV/FELV - only for cats with positive/negative result
          if (isCat) {
            const hasFIV = donor.fiv && (donor.fiv.toLowerCase().includes('positive') || 
                                         donor.fiv.toLowerCase().includes('negative') ||
                                         donor.fiv.toLowerCase().includes('חיובי') || 
                                         donor.fiv.toLowerCase().includes('שלילי'));
            const hasFELV = donor.felv && (donor.felv.toLowerCase().includes('positive') || 
                                           donor.felv.toLowerCase().includes('negative') ||
                                           donor.felv.toLowerCase().includes('חיובי') || 
                                           donor.felv.toLowerCase().includes('שלילי'));
            
            if (hasFIV || hasFELV) {
              monthlyMap[monthKey].fivFelv++;
            }
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
        
        // Calculate external revenue based on actual product types and prices
        let totalExternal = 0;
        let totalExternalRevenue = 0;
        
        // External unit prices
        const prices = {
          wholeBloodDog: 1350,   // דם מלא כלב
          wholeBloodCat: 1650,   // דם מלא חתול
          plasmaDog: 850,        // פלסמה כלב
          plasmaCat: 650,        // פלסמה חתול
          pcDog: 850,            // תרכיז כלב (PC = Packed Cells)
          pcCat: 1650            // תרכיז חתול
        };
        
        // Sum units and calculate accurate revenue
        if (cellData.wholeBloodCat) {
          const units = parseInt(cellData.wholeBloodCat) || 0;
          totalExternal += units;
          totalExternalRevenue += units * prices.wholeBloodCat;
        }
        if (cellData.wholeBloodDog) {
          const units = parseInt(cellData.wholeBloodDog) || 0;
          totalExternal += units;
          totalExternalRevenue += units * prices.wholeBloodDog;
        }
        if (cellData.plasmaCat) {
          const units = parseInt(cellData.plasmaCat) || 0;
          totalExternal += units;
          totalExternalRevenue += units * prices.plasmaCat;
        }
        if (cellData.plasmaDog) {
          const units = parseInt(cellData.plasmaDog) || 0;
          totalExternal += units;
          totalExternalRevenue += units * prices.plasmaDog;
        }
        if (cellData.pcCat) {
          const units = parseInt(cellData.pcCat) || 0;
          totalExternal += units;
          totalExternalRevenue += units * prices.pcCat;
        }
        if (cellData.pcDog) {
          const units = parseInt(cellData.pcDog) || 0;
          totalExternal += units;
          totalExternalRevenue += units * prices.pcDog;
        }
        
        monthlyMap[monthKey].externalUnits = totalExternal;
        monthlyMap[monthKey].externalGross = totalExternalRevenue;
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
        
        // Count external units and calculate revenue with actual prices
        if (archive.totalExternal) {
          const prices = {
            'דם מלא כלב': 1350,
            'דם מלא חתול': 1650,
            'פלסמה כלב': 850,
            'פלסמה חתול': 650,
            'תרכיז כלב': 850,
            'תרכיז חתול': 1650,
            // English fallbacks
            'Whole Blood Dog': 1350,
            'Whole Blood Cat': 1650,
            'Plasma Dog': 850,
            'Plasma Cat': 650,
            'PC Dog': 850,
            'PC Cat': 1650
          };
          
          let archiveRevenue = 0;
          Object.entries(archive.totalExternal).forEach(([type, count]) => {
            monthlyMap[monthKey].externalUnits += count;
            const price = prices[type] || 1200; // Default fallback price
            archiveRevenue += count * price;
          });
          
          monthlyMap[monthKey].externalGross += archiveRevenue;
        }
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
      
      // Apply manual data overrides (shifts, equipment counts, & external units entered by user)
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
        
        // Override equipment counts if manually set
        if (manual.cbcDogs !== undefined && manual.cbcDogs >= 0) {
          monthlyMap[monthKey].cbcDogs = manual.cbcDogs;
        }
        if (manual.cbcCats !== undefined && manual.cbcCats >= 0) {
          monthlyMap[monthKey].cbcCats = manual.cbcCats;
        }
        if (manual.bloodTypes !== undefined && manual.bloodTypes >= 0) {
          monthlyMap[monthKey].bloodTypes = manual.bloodTypes;
        }
        if (manual.dogBags !== undefined && manual.dogBags >= 0) {
          monthlyMap[monthKey].dogBags = manual.dogBags;
        }
        if (manual.fivFelv !== undefined && manual.fivFelv >= 0) {
          monthlyMap[monthKey].fivFelv = manual.fivFelv;
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
          
          const shiftsCount = m.manualShifts !== undefined ? m.manualShifts : m.shifts.size;
          
          // Calculate salary: shifts × (base rate + employee overhead per shift)
          // Min: 2000 base + 300 overhead (2 employees × 150) = 2300 per shift
          // Max: 2640 base + 450 overhead (3 employees × 150) = 3090 per shift
          const minSalary = shiftsCount * 2300;    // 2300₪ per shift (includes 2 employees overhead)
          const maxSalary = shiftsCount * 3090;    // 3090₪ per shift (includes 3 employees overhead)
          const avgSalary = (minSalary + maxSalary) / 2;  // Average of min and max
          
          return {
            ...m,
            // Use manual shifts if set, otherwise use auto-detected
            shifts: shiftsCount,
            // Salary based on shifts + employee overhead
            minSalary,
            maxSalary,
            avgSalary,
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
    
    // grossRevenue from Import/Export already includes everything (including external units)
    // No need to add externalGross separately - that's just for reference/estimation
    const netRevenue = month.grossRevenue - totalExpenses;
    const profitMargin = month.grossRevenue > 0 ? (netRevenue / month.grossRevenue) * 100 : 0;
    const profitRatio = month.grossRevenue > 0 ? netRevenue / month.grossRevenue : 0;
    const calculatedExternalNet = (month.externalGross || 0) * profitRatio;

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
  // Exclude current month (incomplete) and any month with zero revenue
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const completedMonths = calculatedMonths.filter(m => m.month !== currentMonth && m.grossRevenue > 0);
  
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

  // Get external units details from Medicine Usage data
  const getExternalUnitsDetails = (monthKey) => {
    try {
      const inventoryJson = localStorage.getItem('blood_inventory');
      if (!inventoryJson) return [];
      
      const inventoryData = JSON.parse(inventoryJson);
      const sales = inventoryData.sales || [];
      
      // Filter sales from the selected month that have external units
      return sales.filter(sale => {
        const saleDate = new Date(sale.date);
        const saleMonth = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (saleMonth !== monthKey) return false;
        
        // Check if this sale has any external units
        const external = sale.external || {};
        return Object.keys(external).some(key => external[key] > 0);
      }).map(sale => {
        // Extract external units details
        const external = sale.external || {};
        const externalItems = [];
        
        // Map product keys to readable names
        const productNames = {
          wholeBloodDog: 'דם מלא כלב',
          wholeBloodCat: 'דם מלא חתול',
          plasmaDog: 'פלסמה כלב',
          plasmaCat: 'פלסמה חתול',
          pcDog: 'תרכיז כלב (PC)',
          pcCat: 'תרכיז חתול (PC)'
        };
        
        Object.keys(external).forEach(key => {
          const quantity = external[key];
          if (quantity > 0) {
            externalItems.push({
              productType: productNames[key] || key,
              quantity: quantity
            });
          }
        });
        
        return {
          date: sale.date,
          animalName: sale.animalName || 'לא צוין',
          ownerName: sale.ownerName || 'לא צוין',
          fileNumber: sale.fileNumber || 'אין',
          items: externalItems
        };
      });
    } catch (error) {
      console.error('Error loading external units details:', error);
      return [];
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
        {/* Cost Parameters - Collapsible */}
        <div className={`${colors.bg.card} rounded-xl shadow-lg ${colors.border.primary} border overflow-hidden`}>
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors"
            onClick={() => setShowCostParams(!showCostParams)}
          >
            <h2 className={`text-xl font-bold ${colors.text.primary}`}>💰 Cost Parameters</h2>
            <span className="text-lg">{showCostParams ? '▼' : '▶'}</span>
          </div>
          {showCostParams && (
            <div className="p-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2 flex-wrap mb-4">
                <button
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="flex-1 md:flex-none bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:from-purple-600 hover:to-purple-700 shadow-md transition-all duration-200"
                >
                  ✏️ Manual Data
                </button>
                <button
                  onClick={saveSettings}
                  className="flex-1 md:flex-none bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:from-blue-600 hover:to-blue-700 shadow-md transition-all duration-200"
                >
                  💾 Save
                </button>
              </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          )}
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
            <div className="p-4 md:p-6 flex justify-between items-center">
              <h2 className={`text-2xl font-bold ${colors.text.primary}`}>📅 Monthly Summary</h2>
              {calculatedMonths.length > 6 && (
                <button
                  onClick={() => setShowAllMonths(!showAllMonths)}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:from-blue-600 hover:to-blue-700 shadow-md transition-all duration-200"
                >
                  {showAllMonths ? '📅 Last 6 Months' : '📜 Show All'}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={`${colors.bg.secondary}`}>
                  <tr>
                    <th className={`px-3 md:px-6 py-3 text-left text-xs font-semibold ${colors.text.primary}`}>Month</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Shifts</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Donations</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Expenses</th>
                    <th className={`px-3 md:px-6 py-3 text-right text-xs font-semibold ${colors.text.primary}`}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllMonths ? calculatedMonths : calculatedMonths.slice(-6)).map((month, idx) => (
                    <tr key={idx} className={`${colors.border.primary} border-b hover:${colors.bg.tertiary} transition-colors`}>
                      <td className={`px-3 md:px-6 py-3 font-semibold ${colors.text.primary}`}>
                        <div className="flex flex-col">
                          <span>{formatMonth(month.month)}</span>
                          <span className="text-xs opacity-60">{month.month}</span>
                        </div>
                      </td>
                      <td className={`px-3 md:px-6 py-3 text-right ${colors.text.secondary}`}>{month.shifts}</td>
                      <td className={`px-3 md:px-6 py-3 text-right ${colors.text.secondary}`}>{month.donations}</td>
                      <td className={`px-3 md:px-6 py-3 text-right font-semibold text-red-600`}>{formatCurrency(month.totalExpenses)}</td>
                      <td className={`px-3 md:px-6 py-3 text-right font-bold text-green-600`}>{formatCurrency(month.netRevenue)}</td>
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
                {calculatedMonths.filter(m => m.externalUnits > 0).slice(-6).reverse().map((month, idx) => (
                  <div 
                    key={idx} 
                    className={`flex justify-between items-center p-3 ${colors.bg.tertiary} rounded-lg`}
                  >
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

          {/* Bonus Calculator - Collapsible */}
          <div className={`${colors.bg.card} rounded-2xl shadow-lg ${colors.border.primary} border overflow-hidden`}>
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors"
              onClick={() => setShowBonusCalc(!showBonusCalc)}
            >
              <h2 className={`text-xl font-bold ${colors.text.primary}`}>🧮 Bonus Calculator</h2>
              <span className="text-lg">{showBonusCalc ? '▼' : '▶'}</span>
            </div>
            {showBonusCalc && (
            <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700">
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
            )}
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
              
              <div className="space-y-6">
                {calculatedMonths.map((month) => (
                  <div key={month.month} className={`${colors.bg.secondary} p-6 rounded-lg border ${colors.border.primary}`}>
                    {/* Month Header */}
                    <div className={`font-bold text-xl ${colors.text.primary} mb-4 pb-3 border-b ${colors.border.primary}`}>
                      {formatMonth(month.month)} <span className={`text-sm ${colors.text.secondary}`}>({month.month})</span>
                    </div>
                    
                    {/* Input Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Shifts */}
                      <div>
                        <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                          Shifts
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={manualData[month.month]?.shifts || ''}
                          onChange={(e) => saveManualData(month.month, 'shifts', e.target.value)}
                          placeholder={`Auto: ${month.shifts}`}
                          className={`w-full px-3 py-2 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                        />
                        <div className={`text-xs ${colors.text.secondary} mt-1`}>Auto: {month.shifts}</div>
                      </div>
                      
                      {/* CBC Dogs */}
                      <div>
                        <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                          CBC Dogs
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={manualData[month.month]?.cbcDogs !== undefined ? manualData[month.month].cbcDogs : ''}
                          onChange={(e) => saveManualData(month.month, 'cbcDogs', e.target.value)}
                          placeholder={`Auto: ${month.cbcDogs}`}
                          className={`w-full px-3 py-2 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                        />
                        <div className={`text-xs ${colors.text.secondary} mt-1`}>Auto: {month.cbcDogs}</div>
                      </div>
                      
                      {/* CBC Cats */}
                      <div>
                        <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                          CBC Cats
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={manualData[month.month]?.cbcCats !== undefined ? manualData[month.month].cbcCats : ''}
                          onChange={(e) => saveManualData(month.month, 'cbcCats', e.target.value)}
                          placeholder={`Auto: ${month.cbcCats}`}
                          className={`w-full px-3 py-2 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                        />
                        <div className={`text-xs ${colors.text.secondary} mt-1`}>Auto: {month.cbcCats}</div>
                      </div>
                      
                      {/* Blood Types */}
                      <div>
                        <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                          Blood Types
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={manualData[month.month]?.bloodTypes !== undefined ? manualData[month.month].bloodTypes : ''}
                          onChange={(e) => saveManualData(month.month, 'bloodTypes', e.target.value)}
                          placeholder={`Auto: ${month.bloodTypes}`}
                          className={`w-full px-3 py-2 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                        />
                        <div className={`text-xs ${colors.text.secondary} mt-1`}>Auto: {month.bloodTypes}</div>
                      </div>
                      
                      {/* Dog Bags */}
                      <div>
                        <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                          Dog Bags
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={manualData[month.month]?.dogBags !== undefined ? manualData[month.month].dogBags : ''}
                          onChange={(e) => saveManualData(month.month, 'dogBags', e.target.value)}
                          placeholder={`Auto: ${month.dogBags}`}
                          className={`w-full px-3 py-2 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                        />
                        <div className={`text-xs ${colors.text.secondary} mt-1`}>Auto: {month.dogBags}</div>
                      </div>
                      
                      {/* FIV/FELV */}
                      <div>
                        <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                          FIV/FELV
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={manualData[month.month]?.fivFelv !== undefined ? manualData[month.month].fivFelv : ''}
                          onChange={(e) => saveManualData(month.month, 'fivFelv', e.target.value)}
                          placeholder={`Auto: ${month.fivFelv}`}
                          className={`w-full px-3 py-2 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                        />
                        <div className={`text-xs ${colors.text.secondary} mt-1`}>Auto: {month.fivFelv}</div>
                      </div>
                      
                      {/* External Units */}
                      <div>
                        <label className={`block text-sm font-semibold ${colors.text.primary} mb-2`}>
                          External Units
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={manualData[month.month]?.externalUnits || ''}
                          onChange={(e) => saveManualData(month.month, 'externalUnits', e.target.value)}
                          placeholder={`Auto: ${month.externalUnits}`}
                          className={`w-full px-3 py-2 border-2 ${colors.border.primary} rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${colors.bg.primary} ${colors.text.primary}`}
                        />
                        <div className={`text-xs ${colors.text.secondary} mt-1`}>Auto: {month.externalUnits}</div>
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
