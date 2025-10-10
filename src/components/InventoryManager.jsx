import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { donorStorage } from '../utils/storage';

// Blood product definitions - matching the CSV reports
const BLOOD_PRODUCTS = {
  'מנת דם טרי כלב': { code: 'FRESH BLOOD', type: 'fresh', species: 'dog', name_he: 'דם טרי כלב', name_en: 'Fresh Whole Blood Dog' },
  'מנת דם מלא- חתול  mdm cat': { code: 'WHOLE BLOOD CAT', type: 'whole', species: 'cat', name_he: 'דם מלא חתול', name_en: 'Whole Blood Cat' },
  'מנת דם מלא- כלב n mdm dog': { code: 'WHOLE BLOOD DOG', type: 'whole', species: 'dog', name_he: 'דם מלא כלב', name_en: 'Whole Blood Dog' },
  'מנת דם פלסמה חתול  mdp cat': { code: 'PLASMA CAT', type: 'plasma', species: 'cat', name_he: 'פלסמה חתול', name_en: 'Plasma Cat' },
  'מנת דם פלסמה כלב  mdp dog': { code: 'PLASMA DOG', type: 'plasma', species: 'dog', name_he: 'פלסמה כלב', name_en: 'Plasma Dog' },
  'מנת דם תרכיז תאים כלב  mdtt dog': { code: 'PC DOG', type: 'prbc', species: 'dog', name_he: 'תרכיז תאים כלב', name_en: 'pRBC Dog' },
  'מנת דם תרכיז תאים-גדול-חתול  mdttbig cat': { code: 'PC CAT', type: 'prbc_large', species: 'cat', name_he: 'תרכיז תאים גדול חתול', name_en: 'pRBC Large Cat' },
};

const INVENTORY_STORAGE_KEY = 'blood_inventory';
const LOW_STOCK_THRESHOLD = 10;

const InventoryManager = () => {
  const { colors } = useTheme();
  const [inventory, setInventory] = useState({});
  const [monthlySales, setMonthlySales] = useState([]);
  // Track last known cumulative usage per product
  const [lastCumulativeUsage, setLastCumulativeUsage] = useState({});
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  // SET modal state (global)
  const [showSetModal, setShowSetModal] = useState(false);
  const [setValue, setSetValue] = useState('');
  const [setProductKey, setSetProductKey] = useState(null);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = () => {
    const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setInventory(parsed.current || {});
        setMonthlySales(parsed.sales || []);
      } catch (e) {
        console.error('Error loading inventory:', e);
        initializeInventory();
      }
    } else {
      initializeInventory();
    }
  };

  const initializeInventory = () => {
    const initial = {};
    Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
      initial[productKey] = {
        stock: 0,
        received: 0,
        used: 0,
        lastUpdated: new Date().toISOString(),
      };
    });
    setInventory(initial);
    saveInventory(initial, []);
  };

  const saveInventory = (currentInventory, sales) => {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify({
      current: currentInventory,
      sales: sales,
      lastUpdated: new Date().toISOString(),
    }));
  };

  // SET always sets absolute stock
  const updateStock = (productKey, newValue, type = 'manual') => {
    setInventory(prev => {
      const updated = { ...prev };
      if (!updated[productKey]) {
        updated[productKey] = { stock: 0, received: 0, used: 0, lastUpdated: new Date().toISOString() };
      }
      // SET: overwrite stock
      updated[productKey].stock = newValue;
      updated[productKey].lastUpdated = new Date().toISOString();
      saveInventory(updated, monthlySales);
      // Alerts
      if (updated[productKey].stock < LOW_STOCK_THRESHOLD) {
        const message = updated[productKey].stock < 0 
          ? `⚠️ Negative Stock Alert!\n\n${BLOOD_PRODUCTS[productKey].name_he}\nCurrent stock: ${updated[productKey].stock} units\n\n⚠️ Remember to update received units from donations!`
          : `⚠️ Low Stock Alert!\n\n${BLOOD_PRODUCTS[productKey].name_he}\nCurrent stock: ${updated[productKey].stock} units\n\nConsider ordering more stock.`;
        setTimeout(() => alert(message), 500);
      }
      return updated;
    });
  };

  // --- CUMULATIVE USAGE IMPORT LOGIC ---
  const importUsageCSV = async (file) => {
    setImporting(true);
    try {
      const text = await file.text();
      Papa.parse(text, {
        complete: (results) => {
          const data = results.data;
          let totalImported = 0;
          const cumulativeByProduct = {};
          const deltaByProduct = {};
          const externalUsage = {};
          // Parse CSV rows
          data.forEach((row, index) => {
            if (index < 2 || !row[3]) return;
            const medicineName = row[3]?.trim();
            const cumulativeStr = row[7]?.replace(',', '.') || '0';
            const cumulativeUsage = parseFloat(cumulativeStr);
            // זיהוי חיצוני גמיש (עברית/אנגלית, רווחים, סוגריים, גרשיים, דש, גרשיים בודדים/כפולים)
            const isExternal = /[-–—\s'"\(\)\[\]]*['"]?חיצוני['"]?|['"]?external['"]?/i.test(medicineName);
            let matchedProduct = null;
            if (BLOOD_PRODUCTS[medicineName]) {
              matchedProduct = medicineName;
            } else {
              Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
                const productBase = productKey.split(' - ')[0];
                if (medicineName.includes(productBase) || medicineName.includes(BLOOD_PRODUCTS[productKey].code)) {
                  matchedProduct = productKey;
                }
              });
            }
            if (matchedProduct) {
              cumulativeByProduct[matchedProduct] = cumulativeUsage;
              totalImported++;
              if (isExternal) {
                if (!externalUsage[matchedProduct]) externalUsage[matchedProduct] = 0;
                externalUsage[matchedProduct] += cumulativeUsage;
              }
            }
          });
          // Calculate deltas and update inventory
          const updatedInventory = { ...inventory };
          const updatedLastCumulative = { ...lastCumulativeUsage };
          const warnings = [];
          Object.keys(cumulativeByProduct).forEach(productKey => {
            const newCumulative = cumulativeByProduct[productKey];
            const prevCumulative = lastCumulativeUsage[productKey] ?? 0;
            let delta = newCumulative - prevCumulative;
            // If cumulative resets (new < prev), treat as reset
            if (newCumulative < prevCumulative) {
              delta = newCumulative;
              updatedLastCumulative[productKey] = 0;
            }
            if (!updatedInventory[productKey]) {
              updatedInventory[productKey] = { stock: 0, received: 0, used: 0, external: 0, lastUpdated: new Date().toISOString() };
            }
            updatedInventory[productKey].stock = (updatedInventory[productKey].stock || 0) - (delta > 0 ? delta : 0);
            updatedInventory[productKey].used = (updatedInventory[productKey].used || 0) + (delta > 0 ? delta : 0);
            // Accumulate external usage for this product if present in this import
            const externalDelta = externalUsage[productKey] || 0;
            updatedInventory[productKey].external = (updatedInventory[productKey].external || 0) + externalDelta;
            updatedInventory[productKey].lastUpdated = new Date().toISOString();
            updatedLastCumulative[productKey] = newCumulative;
            deltaByProduct[productKey] = delta > 0 ? delta : 0;
            if (updatedInventory[productKey].stock < LOW_STOCK_THRESHOLD) {
              const product = BLOOD_PRODUCTS[productKey];
              warnings.push(`${product.name_he}: Stock is ${updatedInventory[productKey].stock} units (${updatedInventory[productKey].stock < 0 ? 'NEGATIVE' : 'LOW'})`);
            }
          });
          // Add to usage history
          const newUsage = {
            date: new Date().toISOString(),
            fileName: file.name,
            cumulative: cumulativeByProduct,
            delta: deltaByProduct,
            external: externalUsage,
          };
          const updatedHistory = [...monthlySales, newUsage];
          setInventory(updatedInventory);
          setMonthlySales(updatedHistory);
          setLastCumulativeUsage(updatedLastCumulative);
          saveInventory(updatedInventory, updatedHistory);
          setImporting(false);
          setShowImport(false);
          let message = `✅ Import Successful!\n\nImported ${totalImported} usage records\nInventory updated for ${Object.keys(deltaByProduct).length} products\n\nTotal units deducted:\n${Object.keys(deltaByProduct).map(k => `${BLOOD_PRODUCTS[k].name_he}: ${deltaByProduct[k]}`).join('\n')}`;
          if (Object.keys(externalUsage).length > 0) {
            message += `\n\n🏥 External Sales:\n${Object.keys(externalUsage).map(k => `${BLOOD_PRODUCTS[k].name_he}: ${externalUsage[k]}`).join('\n')}`;
          }
          if (warnings.length > 0) {
            message += `\n\n⚠️ Warnings:\n${warnings.join('\n')}`;
          }
          alert(message);
        },
        error: (error) => {
          console.error('CSV parse error:', error);
          alert('❌ Error parsing CSV file');
          setImporting(false);
        }
      });
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('❌ Error reading file');
      setImporting(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      importUsageCSV(file);
    }
  };

  const deleteImportHistory = (index) => {
    if (confirm('Are you sure you want to delete this import record? This will recalculate inventory.')) {
      // Remove the import
      const updated = monthlySales.filter((_, i) => i !== index);

      // Recalculate inventory from scratch using remaining imports
      const recalculated = {};
      Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
        recalculated[productKey] = {
          stock: inventory[productKey]?.received || 0, // Keep received amount
          received: inventory[productKey]?.received || 0,
          used: 0,
          external: 0,
          lastUpdated: new Date().toISOString(),
        };
      });

      // Reapply remaining imports using sale.delta
      updated.forEach(sale => {
        if (sale.delta) {
          Object.keys(sale.delta).forEach(productKey => {
            if (recalculated[productKey]) {
              recalculated[productKey].used += sale.delta[productKey];
              recalculated[productKey].stock = recalculated[productKey].received - recalculated[productKey].used;
              // Reapply external tracking
              if (sale.external && sale.external[productKey]) {
                recalculated[productKey].external += sale.external[productKey];
              }
            }
          });
        }
      });

      setInventory(recalculated);
      setMonthlySales(updated);
      saveInventory(recalculated, updated);
    }
  };

  const resetAllData = () => {
    if (confirm('⚠️ WARNING: This will delete ALL inventory data and import history for this month.\n\nAre you absolutely sure?')) {
      if (confirm('This action cannot be undone. Continue?')) {
        initializeInventory();
        alert('✅ All data has been reset.');
      }
    }
  };

  const getLowStockProducts = () => {
    return Object.keys(inventory).filter(key => 
      inventory[key].stock < LOW_STOCK_THRESHOLD && inventory[key].stock >= 0
    );
  };

  const getNegativeStockProducts = () => {
    return Object.keys(inventory).filter(key => 
      inventory[key].stock < 0
    );
  };

  const getTotalStock = () => {
    return Object.values(inventory).reduce((sum, item) => sum + item.stock, 0);
  };

  const getMonthlyExternalSummary = () => {
    const summary = {};
    
    // Show only current month external units (no revenue - that's in Financial tab)
    Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
      const externalUnits = inventory[productKey]?.external || 0;
      if (externalUnits > 0) {
        summary[productKey] = {
          units: externalUnits
        };
      }
    });
    
    return { summary, totalExternalRevenue: 0 };
  };

  const lowStockProducts = getLowStockProducts();
  const negativeStockProducts = getNegativeStockProducts();
  const { summary: externalSummary, totalExternalRevenue } = getMonthlyExternalSummary();

  return (
    <div className={`w-full max-w-7xl mx-auto ${colors.text.primary} p-4`}>
      <div className={`${colors.bg.card} rounded-3xl shadow-2xl p-8 mb-6 border ${colors.border.primary}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              📦 Blood Inventory Manager
            </h2>
            <p className={`text-sm ${colors.text.secondary}`}>Import daily usage reports • Update stock manually</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-3 rounded-xl font-bold hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
              <span className="text-xl">📥</span>
              <span className="text-sm">Import</span>
            </button>
            <button
              onClick={resetAllData}
              className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-3 rounded-xl font-bold hover:from-red-600 hover:to-rose-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
              <span className="text-xl">�️</span>
              <span className="text-sm">Reset</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}

        {/* Symmetric Summary Cards */}
  <div className="grid grid-cols-3 gap-3 mb-6 w-full max-w-sm mx-auto">
          {/* Total Units in Stock */}
          <div className="bg-white/80 dark:bg-gray-800/80 border border-blue-300 dark:border-blue-700 rounded-xl shadow flex flex-col items-center justify-center text-center aspect-square min-w-[80px] min-h-[80px] p-0">
            <div className="flex flex-col justify-center items-center h-full w-full">
              <span className="text-xl md:text-2xl font-extrabold text-blue-600 dark:text-blue-300 mb-1">{getTotalStock()}</span>
              <span className="text-xs md:text-sm font-semibold text-blue-800 dark:text-blue-300">Total Units in Stock</span>
            </div>
          </div>
          {/* Low Stock Alerts */}
          <div className="bg-white/80 dark:bg-gray-800/80 border border-red-300 dark:border-red-700 rounded-xl shadow flex flex-col items-center justify-center text-center aspect-square min-w-[80px] min-h-[80px] p-0">
            <div className="flex flex-col justify-center items-center h-full w-full">
              <span className="text-xl md:text-2xl font-extrabold text-red-600 dark:text-red-400 mb-1">{lowStockProducts.length}</span>
              <span className="text-xs md:text-sm font-semibold text-red-800 dark:text-red-300">Low Stock Alerts</span>
            </div>
          </div>
          {/* Usage Reports Imported */}
          <div className="bg-white/80 dark:bg-gray-800/80 border border-emerald-300 dark:border-emerald-700 rounded-xl shadow flex flex-col items-center justify-center text-center aspect-square min-w-[80px] min-h-[80px] p-0">
            <div className="flex flex-col justify-center items-center h-full w-full">
              <span className="text-xl md:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-1">{monthlySales.length}</span>
              <span className="text-xs md:text-sm font-semibold text-emerald-800 dark:text-emerald-300">Usage Reports Imported</span>
            </div>
          </div>
        </div>

        {/* Inventory Cards - Separated by Species */}
        <div className="space-y-8">
          {/* Dog Products */}
          <div>
            <h4 className="text-lg font-bold mb-2 drop-shadow-lg text-white dark:text-white dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">🐶 Dog Blood Products</h4>
            <div className="space-y-3">
              {Object.keys(BLOOD_PRODUCTS)
                .filter((productKey) => BLOOD_PRODUCTS[productKey].species === 'dog')
                .map((productKey) => {
                  const product = BLOOD_PRODUCTS[productKey];
                  const stock = inventory[productKey] || { stock: 0, received: 0, used: 0, external: 0 };
                  const displayStock = Math.max(0, stock.stock);
                  const displayReceived = Math.max(0, stock.received);
                  const displayUsed = Math.max(0, stock.used);
                  const displayExternal = Math.max(0, stock.external || 0);
                  const handleSetStock = () => {
                    setSetValue(String(displayStock));
                    setSetProductKey(productKey);
                    setShowSetModal(true);
                  };
                  // Show warning if stock is low or negative
                  const isLow = stock.stock < LOW_STOCK_THRESHOLD && stock.stock >= 0;
                  const isNegative = stock.stock < 0;
                  return (
                    <div key={productKey} className="rounded-xl shadow-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2 flex flex-col md:flex-row md:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm truncate flex-1">{product.code}</span>
                          <button
                            onClick={handleSetStock}
                            className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            title={`Set stock for ${product.name_en}`}
                          >SET</button>
                        </div>
                        {(isLow || isNegative) && (
                          <div className={`mb-2 text-xs font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-300'}`}
                            style={{letterSpacing: '0.5px'}}>
                            {isNegative ? '⚠️ Negative Stock! Please update received units.' : '⚠️ Low Stock!'}
                          </div>
                        )}
                        <div className="grid grid-cols-4 gap-1 text-sm md:text-base">
                          <div className="text-center">
                            <div className="font-semibold text-gray-500 dark:text-gray-400 text-base md:text-lg">Stock</div>
                            <div className="font-bold text-indigo-700 dark:text-indigo-300 text-lg md:text-xl">{displayStock}</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-emerald-600 dark:text-emerald-400 text-base md:text-lg">In</div>
                            <div className="font-bold text-emerald-700 dark:text-emerald-300 text-lg md:text-xl">+{displayReceived}</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-rose-600 dark:text-rose-400 text-base md:text-lg">Out</div>
                            <div className="font-bold text-rose-700 dark:text-rose-300 text-lg md:text-xl">-{displayUsed}</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-blue-600 dark:text-blue-400 text-base md:text-lg">External</div>
                            <div className="font-bold text-blue-700 dark:text-blue-300 text-lg md:text-xl">{displayExternal}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
          {/* Cat Products */}
          <div>
            <h4 className="text-lg font-bold mb-2 mt-4 drop-shadow-lg text-white dark:text-white dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">🐱 Cat Blood Products</h4>
            <div className="space-y-3">
              {Object.keys(BLOOD_PRODUCTS)
                .filter((productKey) => BLOOD_PRODUCTS[productKey].species === 'cat')
                .map((productKey) => {
                  const product = BLOOD_PRODUCTS[productKey];
                  const stock = inventory[productKey] || { stock: 0, received: 0, used: 0, external: 0 };
                  const displayStock = Math.max(0, stock.stock);
                  const displayReceived = Math.max(0, stock.received);
                  const displayUsed = Math.max(0, stock.used);
                  const displayExternal = Math.max(0, stock.external || 0);
                  const handleSetStock = () => {
                    setSetValue(String(displayStock));
                    setSetProductKey(productKey);
                    setShowSetModal(true);
                  };
                  // Show warning if stock is low or negative
                  const isLow = stock.stock < LOW_STOCK_THRESHOLD && stock.stock >= 0;
                  const isNegative = stock.stock < 0;
                  return (
                    <div key={productKey} className="rounded-xl shadow-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2 flex flex-col md:flex-row md:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm truncate flex-1">{product.code}</span>
                          <button
                            onClick={handleSetStock}
                            className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            title={`Set stock for ${product.name_en}`}
                          >SET</button>
      {/* SET Modal (global) */}
      {showSetModal && setProductKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSetModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 min-w-[260px] max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <div className="mb-4 text-lg font-bold text-indigo-700 dark:text-indigo-300">Set stock for {BLOOD_PRODUCTS[setProductKey].name_en}</div>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-full border-2 border-indigo-400 rounded-lg p-3 text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100"
              value={setValue}
              onChange={e => setSetValue(e.target.value.replace(/[^0-9]/g, ''))}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSetModal(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold">Cancel</button>
              <button
                onClick={() => {
                  if (setValue !== '' && !isNaN(setValue)) {
                    updateStock(setProductKey, parseInt(setValue), 'received');
                    setShowSetModal(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white font-bold hover:bg-blue-600"
              >Set</button>
            </div>
          </div>
        </div>
      )}
                        </div>
                        {(isLow || isNegative) && (
                          <div className={`mb-2 text-xs font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-300'}`}
                            style={{letterSpacing: '0.5px'}}>
                            {isNegative ? '⚠️ Negative Stock! Please update received units.' : '⚠️ Low Stock!'}
                          </div>
                        )}
                        <div className="grid grid-cols-4 gap-1 text-sm md:text-base">
                          <div className="text-center">
                            <div className="font-semibold text-gray-500 dark:text-gray-400 text-base md:text-lg">Stock</div>
                            <div className="font-bold text-indigo-700 dark:text-indigo-300 text-lg md:text-xl">{displayStock}</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-emerald-600 dark:text-emerald-400 text-base md:text-lg">In</div>
                            <div className="font-bold text-emerald-700 dark:text-emerald-300 text-lg md:text-xl">+{displayReceived}</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-rose-600 dark:text-rose-400 text-base md:text-lg">Out</div>
                            <div className="font-bold text-rose-700 dark:text-rose-300 text-lg md:text-xl">-{displayUsed}</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-blue-600 dark:text-blue-400 text-base md:text-lg">External</div>
                            <div className="font-bold text-blue-700 dark:text-blue-300 text-lg md:text-xl">{displayExternal}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* External Sales at Bottom */}
        {Object.keys(externalSummary).length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-400 dark:border-blue-600 rounded-2xl p-6 mt-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">🏥</div>
              <h3 className="text-xl md:text-2xl font-bold text-blue-800 dark:text-blue-200">External Sales - Current Month</h3>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-2">
              {Object.keys(externalSummary).map(productKey => {
                const data = externalSummary[productKey];
                return (
                  <div key={productKey} className="rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 overflow-hidden">
                    {/* Centered Product header */}
                    <div className="px-3 py-2 border-b border-blue-200 dark:border-blue-700 text-center">
                      <span className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold whitespace-nowrap">
                        {BLOOD_PRODUCTS[productKey].code}
                      </span>
                    </div>
                    {/* Stats */}
                    <div className="px-3 py-2 text-center">
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Units</div>
                      <div className="text-base font-extrabold text-blue-800 dark:text-blue-200">{data.units.toFixed(1)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Import History */}
        {monthlySales.length > 0 && (
          <div className="mt-8">
            <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Import History</h3>
            <div className="space-y-2">
              {monthlySales.map((sale, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="font-semibold text-sm">{sale.fileName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(sale.date).toLocaleString('he-IL')} • {sale.delta ? Object.keys(sale.delta).length : 0} products
                    </div>
                  </div>
                  <button
                    onClick={() => deleteImportHistory(index)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-40" onClick={() => !importing && setShowImport(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className={`${colors.bg.card} rounded-3xl shadow-2xl p-8 max-w-lg w-full border-2 ${colors.border.primary}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="text-4xl">📥</div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Import Usage Report</h3>
              </div>
              <p className={`text-sm ${colors.text.secondary} mb-6 leading-relaxed`}>
                Select the daily <strong>Medicine Usage CSV report</strong> from your clinic system to import and automatically update inventory.
              </p>
              
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                disabled={importing}
                className={`w-full mb-6 p-4 border-2 border-dashed rounded-xl ${colors.border.primary} hover:border-indigo-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200`}
              />

              {importing && (
                <div className="text-center py-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-3"></div>
                  <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Importing data...</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowImport(false)}
                  disabled={importing}
                  className="flex-1 bg-gradient-to-r from-gray-400 to-gray-500 text-white px-6 py-3 rounded-xl font-bold hover:from-gray-500 hover:to-gray-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InventoryManager;
