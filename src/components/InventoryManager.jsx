import React, { useState, useEffect, useMemo } from 'react';
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
  // Track processed invoice rows to avoid duplicates - PER MONTH
  const [processedInvoices, setProcessedInvoices] = useState(new Set());
  const [currentMonthKey, setCurrentMonthKey] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  // SET modal state (global)
  const [showSetModal, setShowSetModal] = useState(false);
  const [setValue, setSetValue] = useState('');
  const [setProductKey, setSetProductKey] = useState(null);
  // External sales details modal
  const [showExternalDetailsModal, setShowExternalDetailsModal] = useState(false);
  const [selectedExternalMonth, setSelectedExternalMonth] = useState(null);
  // Collapsible sections for dogs and cats - default open
  const [showDogProducts, setShowDogProducts] = useState(true);
  const [showCatProducts, setShowCatProducts] = useState(true);

  useEffect(() => {
    loadInventory();
    checkMonthlyArchive();
  }, []);

  // Check if it's time to archive monthly data
  const checkMonthlyArchive = () => {
    const lastArchiveDate = localStorage.getItem('inventory_last_archive');
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    if (!lastArchiveDate) {
      // First time - just set the current month
      localStorage.setItem('inventory_last_archive', currentMonth);
      return;
    }
    
    // Check if we're in a new month
    if (lastArchiveDate !== currentMonth) {
      // It's a new month! Ask user if they want to archive
      const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const sales = parsed.sales || [];
          
          // Check if there's any usage data in inventory
          let hasUsageData = sales.length > 0;
          if (parsed.current && !hasUsageData) {
            hasUsageData = Object.values(parsed.current).some(
              product => (product.used || 0) > 0 || (product.external || 0) > 0
            );
          }
          
          if (hasUsageData) {
            const lastMonthName = new Date(lastArchiveDate + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            if (window.confirm(`📊 New Month Detected!\n\nWould you like to archive the data from ${lastMonthName}?\n\nThis will save a monthly summary and start fresh tracking for the new month.\n\n(Current usage history has ${sales.length} records)`)) {
              archiveMonthlyData(lastArchiveDate, sales);
            } else {
              // User declined, but we should still reset counters for new month
              if (parsed.current) {
                Object.keys(parsed.current).forEach(key => {
                  parsed.current[key].used = 0;
                  parsed.current[key].external = 0;
                });
                localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(parsed));
                setInventory(prev => {
                  const updated = { ...prev };
                  Object.keys(updated).forEach(key => {
                    updated[key] = { ...updated[key], used: 0, external: 0 };
                  });
                  return updated;
                });
              }
            }
            // Update last archive date either way
            localStorage.setItem('inventory_last_archive', currentMonth);
          } else {
            // No data to archive, just update the month marker
            localStorage.setItem('inventory_last_archive', currentMonth);
          }
        } catch (e) {
          console.error('Error checking monthly archive:', e);
        }
      }
    }
  };

  const archiveMonthlyData = (monthKey, salesData) => {
    try {
      // Get existing archives
      const archivesJson = localStorage.getItem('inventory_monthly_archives');
      const archives = archivesJson ? JSON.parse(archivesJson) : [];
      
      // Calculate monthly summary from current inventory state
      const summary = {
        month: monthKey,
        archivedAt: new Date().toISOString(),
        totalRecords: salesData.length,
        totalUsage: {},
        totalExternal: {},
        inventorySnapshot: {}, // Save the inventory state at archive time
        externalSalesDetails: [] // Save all external sales details
      };
      
      // Collect all external sales details from the sales data
      salesData.forEach(importRecord => {
        if (importRecord.externalDetails && importRecord.externalDetails.length > 0) {
          summary.externalSalesDetails.push(...importRecord.externalDetails);
        }
      });
      
      // Save current inventory totals before reset
      Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
        const product = inventory[productKey];
        if (product) {
          if (product.used > 0) {
            summary.totalUsage[productKey] = product.used;
          }
          if (product.external > 0) {
            summary.totalExternal[productKey] = product.external;
          }
          summary.inventorySnapshot[productKey] = { ...product };
        }
      });
      
      // Add detailed records
      summary.records = salesData;
      
      // Save archive
      archives.push(summary);
      localStorage.setItem('inventory_monthly_archives', JSON.stringify(archives));
      
      // Clear current sales data AND reset inventory usage counters
      const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.sales = []; // Clear sales history
        
        // Reset used and external counters in inventory (keep stock/initial)
        if (parsed.current) {
          Object.keys(parsed.current).forEach(key => {
            parsed.current[key].used = 0;
            parsed.current[key].external = 0;
            // Keep: stock, initial, received, lastUpdated
          });
        }
        
        localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(parsed));
        setMonthlySales([]);
        
        // Update inventory state to reflect the reset
        setInventory(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(key => {
            updated[key] = {
              ...updated[key],
              used: 0,
              external: 0
            };
          });
          return updated;
        });
      }
      
      alert(`✅ Monthly archive created!\n\nMonth: ${monthKey}\nRecords archived: ${salesData.length}\nTotal products used: ${Object.keys(summary.totalUsage).length}\n\nYou can now start fresh for the new month.`);
    } catch (error) {
      console.error('Error archiving monthly data:', error);
      alert('❌ Failed to archive monthly data: ' + error.message);
    }
  };

  const loadInventory = () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonthKey(monthKey);
    
    const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setInventory(parsed.current || {});
        setMonthlySales(parsed.sales || []);
        
        // Load processedInvoices for CURRENT MONTH ONLY
        const allProcessed = parsed.processedInvoicesByMonth || {};
        setProcessedInvoices(new Set(allProcessed[monthKey] || []));
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

  const saveInventory = (currentInventory, sales, processedInvoicesArray = null, monthKeyToSave = null) => {
    const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    
    // Get existing processedInvoices by month
    const allProcessed = parsed.processedInvoicesByMonth || {};
    
    // Update for current month
    const monthKey = monthKeyToSave || currentMonthKey;
    const invoicesToSave = processedInvoicesArray !== null ? processedInvoicesArray : Array.from(processedInvoices);
    allProcessed[monthKey] = invoicesToSave;
    
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify({
      current: currentInventory,
      sales: sales,
      processedInvoicesByMonth: allProcessed,
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
      if (!file) {
        throw new Error('No file selected');
      }
      
      if (file.size === 0) {
        throw new Error('File is empty');
      }
      
      let text;
      try {
        text = await file.text();
      } catch (readError) {
        console.error('Error reading file:', readError);
        // Try alternative method using FileReader
        text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(new Error('Failed to read file: ' + e.target.error));
          reader.readAsText(file);
        });
      }
      
      if (!text || text.trim().length === 0) {
        throw new Error('File content is empty');
      }
      
      Papa.parse(text, {
        complete: async (results) => {
          const data = results.data;
          let totalImported = 0;
          const cumulativeByProduct = {};
          const deltaByProduct = {};
          const externalUsage = {};
          const externalSalesDetails = []; // New: store detailed external sales info
          let csvDate = null; // Extract date from CSV
          
          // FIRST PASS: Extract CSV date to determine which month's processedInvoices to use
          // Skip header rows (first 3 rows) and find first row with actual date data
          for (let i = 3; i < data.length; i++) {
            const dateCandidate = data[i][1]?.trim();
            // Skip if it's a header like "Created timestamp" or empty
            if (dateCandidate && 
                !dateCandidate.toLowerCase().includes('created') && 
                !dateCandidate.toLowerCase().includes('timestamp') &&
                !dateCandidate.toLowerCase().includes('date')) {
              csvDate = dateCandidate;
              break;
            }
          }
          
          // Determine which month this CSV belongs to
          let csvDateObj;
          let csvMonth;
          
          try {
            if (!csvDate) {
              throw new Error('No date found in CSV');
            }
            
            // Try parsing the date - handle multiple formats
            // Common formats: DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD
            let parsedDate;
            
            if (csvDate.includes('/')) {
              // DD/MM/YYYY format
              const parts = csvDate.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
                const year = parseInt(parts[2]);
                parsedDate = new Date(year, month, day);
              }
            } else if (csvDate.includes('.')) {
              // DD.MM.YYYY format
              const parts = csvDate.split('.');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parseInt(parts[2]);
                parsedDate = new Date(year, month, day);
              }
            } else if (csvDate.includes('-')) {
              // YYYY-MM-DD format
              parsedDate = new Date(csvDate);
            } else {
              // Try direct parsing
              parsedDate = new Date(csvDate);
            }
            
            if (!parsedDate || isNaN(parsedDate.getTime())) {
              throw new Error(`Invalid date format: ${csvDate}`);
            }
            
            csvDateObj = parsedDate;
            csvMonth = `${csvDateObj.getFullYear()}-${String(csvDateObj.getMonth() + 1).padStart(2, '0')}`;
            
          } catch (dateError) {
            console.error('Date parsing error:', dateError);
            // Fallback to current month
            csvDateObj = new Date();
            csvMonth = `${csvDateObj.getFullYear()}-${String(csvDateObj.getMonth() + 1).padStart(2, '0')}`;
          }
          
          // Load the correct month's processedInvoices Set
          const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
          const parsed = saved ? JSON.parse(saved) : {};
          const allProcessed = parsed.processedInvoicesByMonth || {};
          const csvMonthProcessed = new Set(allProcessed[csvMonth] || []);
          
          // SECOND PASS: Parse CSV rows - now with correct month's duplicate detection
          data.forEach((row, index) => {
            // Skip header rows and empty rows
            if (index < 3 || !row[3]) return;
            
            const invoiceRowId = row[0]?.trim(); // Invoice row # column
            const medicineName = row[3]?.trim();
            
            // Skip rows without invoice ID, or rows that are summary/total rows
            if (!medicineName || !invoiceRowId) return;
            if (medicineName.toLowerCase().includes('total') || medicineName.toLowerCase().includes('all total')) return;
            
            // Skip if this invoice row was already processed IN THIS CSV'S MONTH
            if (csvMonthProcessed.has(invoiceRowId)) {
              return;
            }
            
            // Try both column 6 and 7 for quantity (packages and units)
            let cumulativeStr = row[6]?.replace(',', '.') || row[7]?.replace(',', '.') || '0';
            const cumulativeUsage = parseFloat(cumulativeStr);
            
            if (isNaN(cumulativeUsage) || cumulativeUsage <= 0) return;
            
            // זיהוי חיצוני - מחפש "חיצוני" או "external" בכל מקום בשם (עם או בלי גרשיים/סימנים)
            const isExternal = /חיצוני|external/i.test(medicineName);
            let matchedProduct = null;
            
            // Normalize medicine name for better matching
            const medicineNameLower = medicineName.toLowerCase().trim();
            
            // Direct match first
            if (BLOOD_PRODUCTS[medicineName]) {
              matchedProduct = medicineName;
            } else {
              // Enhanced partial matching with multiple strategies
              Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
                if (matchedProduct) return; // Already found
                
                const product = BLOOD_PRODUCTS[productKey];
                const productCode = product.code.toLowerCase();
                const productNameHe = product.name_he.toLowerCase();
                
                // Strategy 1: Check for product codes (mdm, mdp, mdtt, mdttbig)
                if (medicineNameLower.includes('mdttbig') && medicineNameLower.includes('cat')) {
                  if (productKey.includes('mdttbig cat')) matchedProduct = productKey;
                } else if (medicineNameLower.includes('mdtt') && medicineNameLower.includes('dog')) {
                  if (productKey.includes('mdtt dog') && !productKey.includes('mdttbig')) matchedProduct = productKey;
                } else if (medicineNameLower.includes('mdm') && medicineNameLower.includes('cat')) {
                  if (productKey.includes('mdm cat')) matchedProduct = productKey;
                } else if (medicineNameLower.includes('mdm') && medicineNameLower.includes('dog')) {
                  if (productKey.includes('mdm') && productKey.includes('dog')) matchedProduct = productKey;
                } else if (medicineNameLower.includes('mdp') && medicineNameLower.includes('cat')) {
                  if (productKey.includes('mdp cat')) matchedProduct = productKey;
                } else if (medicineNameLower.includes('mdp') && medicineNameLower.includes('dog')) {
                  if (productKey.includes('mdp') && productKey.includes('dog')) matchedProduct = productKey;
                }
                
                // Strategy 2: Check for English product codes in the BLOOD_PRODUCTS definition
                if (!matchedProduct && productCode && medicineNameLower.includes(productCode.toLowerCase())) {
                  matchedProduct = productKey;
                }
                
                // Strategy 3: Check for Hebrew name parts
                if (!matchedProduct) {
                  const hebrewParts = productNameHe.split(' ');
                  const matchCount = hebrewParts.filter(part => part.length > 2 && medicineNameLower.includes(part)).length;
                  if (matchCount >= 2) { // At least 2 words match
                    matchedProduct = productKey;
                  }
                }
              });
            }
            
            if (matchedProduct) {
              totalImported++;
              
              if (isExternal) {
                // External - add only to externalUsage, NOT to internal
                if (!externalUsage[matchedProduct]) externalUsage[matchedProduct] = 0;
                externalUsage[matchedProduct] += cumulativeUsage;
                
                // Extract details for external sales
                const saleDate = row[1]?.trim() || new Date().toISOString().split('T')[0]; // Column B (index 1): date
                const fileNumber = 'אין'; // No file number column in this CSV
                const ownerName = row[9]?.trim() || 'לא צוין'; // Column J (index 9): client name
                const animalName = row[11]?.trim() || 'לא צוין'; // Column L (index 11): patient name
                
                externalSalesDetails.push({
                  date: saleDate,
                  fileNumber: fileNumber,
                  ownerName: ownerName,
                  animalName: animalName,
                  productKey: matchedProduct,
                  quantity: Number(cumulativeUsage.toFixed(2)),
                  productName: BLOOD_PRODUCTS[matchedProduct].name_he,
                  month: csvMonth // Add month identifier
                });
              } else {
                // Internal - add to cumulativeByProduct
                if (!cumulativeByProduct[matchedProduct]) {
                  cumulativeByProduct[matchedProduct] = 0;
                }
                cumulativeByProduct[matchedProduct] += cumulativeUsage;
              }
              
              // Add to the CSV month's processed invoices set (not current month!)
              csvMonthProcessed.add(invoiceRowId);
            }
          });
          
          // Check if nothing new was imported
          if (totalImported === 0) {
            alert('ℹ️ No new records found!\n\nAll invoice rows in this file have already been processed.');
            setImporting(false);
            document.querySelector('input[type="file"]').value = '';
            return;
          }
          
          // FIRST: Check if CSV is from previous month BEFORE updating inventory
          // (csvDateObj and csvMonth already defined at top of function)
          const currentMonth = new Date();
          const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
          const isHistoricalImport = csvMonth !== currentMonthKey;
          
          // Calculate deltas - but only update inventory if NOT historical
          const updatedInventory = isHistoricalImport ? { ...inventory } : { ...inventory }; // Clone in both cases
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
            
            deltaByProduct[productKey] = Number((delta > 0 ? delta : 0).toFixed(2));
            
            // Only update current inventory if this is NOT a historical import
            if (!isHistoricalImport) {
              if (!updatedInventory[productKey]) {
                updatedInventory[productKey] = { stock: 0, received: 0, used: 0, external: 0, lastUpdated: new Date().toISOString() };
              }
              updatedInventory[productKey].stock = Number(((updatedInventory[productKey].stock || 0) - (delta > 0 ? delta : 0)).toFixed(2));
              updatedInventory[productKey].used = Number(((updatedInventory[productKey].used || 0) + (delta > 0 ? delta : 0)).toFixed(2));
              
              // Accumulate external usage for this product if present in this import
              const externalDelta = externalUsage[productKey] || 0;
              updatedInventory[productKey].external = Number(((updatedInventory[productKey].external || 0) + externalDelta).toFixed(2));
              updatedInventory[productKey].lastUpdated = new Date().toISOString();
              updatedLastCumulative[productKey] = newCumulative;
              
              if (updatedInventory[productKey].stock < LOW_STOCK_THRESHOLD) {
                const product = BLOOD_PRODUCTS[productKey];
                warnings.push(`${product.name_he}: Stock is ${updatedInventory[productKey].stock} units (${updatedInventory[productKey].stock < 0 ? 'NEGATIVE' : 'LOW'})`);
              }
            }
          });
          
          // Add to usage history - use parsed CSV date if available, otherwise current date
          const usageDate = csvDateObj ? csvDateObj.toISOString() : new Date().toISOString();
          const importDate = new Date().toISOString(); // When the import actually happened
          const newUsage = {
            date: usageDate, // CSV date (for display/archive purposes)
            importDate: importDate, // When we imported this file (for "last 24h" tracking)
            fileName: file.name,
            cumulative: cumulativeByProduct,
            delta: deltaByProduct,
            external: externalUsage,
            externalDetails: externalSalesDetails // Save the detailed external sales info
          };
          
          // Now handle based on whether it's historical or current month
          let updatedHistory = monthlySales;
          
          // If CSV is from PREVIOUS month, archive it directly instead of adding to current month
          if (isHistoricalImport) {
            const csvMonthName = csvDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            // Add to archive directly
            const archivesJson = localStorage.getItem('inventory_monthly_archives');
            const archives = archivesJson ? JSON.parse(archivesJson) : [];
            
            // Check if archive for this month already exists
            let existingArchive = archives.find(a => a.month === csvMonth);
            if (!existingArchive) {
              existingArchive = {
                month: csvMonth,
                archivedAt: new Date().toISOString(),
                totalRecords: 0,
                totalUsage: {},
                totalExternal: {},
                inventorySnapshot: {},
                externalSalesDetails: [],
                records: []
              };
              archives.push(existingArchive);
            }
            
            // Add this import to the archive
            existingArchive.records.push(newUsage);
            existingArchive.totalRecords = existingArchive.records.length;
            
            // Update totals and snapshot
            Object.keys(deltaByProduct).forEach(productKey => {
              const delta = Number(deltaByProduct[productKey]);
              existingArchive.totalUsage[productKey] = Number(((existingArchive.totalUsage[productKey] || 0) + delta).toFixed(2));
              
              // Update inventory snapshot for this product
              if (!existingArchive.inventorySnapshot[productKey]) {
                existingArchive.inventorySnapshot[productKey] = {
                  stock: 0,
                  used: 0,
                  external: 0,
                  received: 0
                };
              }
              existingArchive.inventorySnapshot[productKey].used = Number(((existingArchive.inventorySnapshot[productKey].used || 0) + delta).toFixed(2));
            });
            
            Object.keys(externalUsage).forEach(productKey => {
              const external = Number(externalUsage[productKey]);
              existingArchive.totalExternal[productKey] = Number(((existingArchive.totalExternal[productKey] || 0) + external).toFixed(2));
              
              // Update inventory snapshot external
              if (!existingArchive.inventorySnapshot[productKey]) {
                existingArchive.inventorySnapshot[productKey] = {
                  stock: 0,
                  used: 0,
                  external: 0,
                  received: 0
                };
              }
              existingArchive.inventorySnapshot[productKey].external = Number(((existingArchive.inventorySnapshot[productKey].external || 0) + external).toFixed(2));
            });
            
            if (externalSalesDetails.length > 0) {
              existingArchive.externalSalesDetails.push(...externalSalesDetails);
            }
            
            console.log('📦 Archive saved:', existingArchive);
            localStorage.setItem('inventory_monthly_archives', JSON.stringify(archives));
            
            warnings.push(`📚 CSV from ${csvMonthName} - Added to archive instead of current month`);
            console.log(`✅ Archived to ${csvMonth}:`, newUsage);
          } else {
            // Current month - add to history normally
            updatedHistory = [...monthlySales, newUsage];
          }
          
          // Update state and save (csvMonthProcessed already contains all invoices for this CSV's month)
          setInventory(updatedInventory);
          setMonthlySales(updatedHistory);
          
          // Only update cumulative if current month (historical imports don't affect tracking)
          if (!isHistoricalImport) {
            setLastCumulativeUsage(updatedLastCumulative);
          }
          
          // Save the CSV month's processed invoices to localStorage
          const savedData = localStorage.getItem(INVENTORY_STORAGE_KEY);
          const parsedData = savedData ? JSON.parse(savedData) : {};
          const allProcessedByMonth = parsedData.processedInvoicesByMonth || {};
          allProcessedByMonth[csvMonth] = Array.from(csvMonthProcessed);
          parsedData.processedInvoicesByMonth = allProcessedByMonth;
          
          if (!isHistoricalImport) {
            // Current month - update state AND save
            setProcessedInvoices(new Set(csvMonthProcessed)); // Update state with new Set
            parsedData.current = updatedInventory;
            parsedData.sales = updatedHistory;
            parsedData.lastUpdated = new Date().toISOString();
            localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(parsedData));
          } else {
            // Historical import - only save the processedInvoices, don't update current inventory
            localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(parsedData));
          }
          setImporting(false);
          setShowImport(false);
          // Reset file input
          document.querySelector('input[type="file"]').value = '';
          
          let message = isHistoricalImport 
            ? `✅ Historical Import Successful!\n\nProcessed ${totalImported} records from previous month\nData added to monthly archive (${csvMonth})\n\n📚 View in "View Archives" section`
            : `✅ Import Successful!\n\nProcessed ${totalImported} NEW usage records\nInventory updated for ${Object.keys(deltaByProduct).length} products`;
          
          if (!isHistoricalImport) {
            message += `\n\nTotal units deducted:\n${Object.keys(deltaByProduct).map(k => `${BLOOD_PRODUCTS[k].name_he}: ${Number(deltaByProduct[k]).toFixed(2)}`).join('\n')}`;
          }
          
          if (Object.keys(externalUsage).length > 0) {
            message += `\n\n🏥 External Sales:\n${Object.keys(externalUsage).map(k => `${BLOOD_PRODUCTS[k].name_he}: ${Number(externalUsage[k]).toFixed(2)}`).join('\n')}`;
          }
          if (warnings.length > 0) {
            message += `\n\n⚠️ Notes:\n${warnings.join('\n')}`;
          }
          
          const skippedCount = data.length - 3 - totalImported; // Total rows minus headers minus imported
          if (skippedCount > 0) {
            message += `\n\n📝 ${skippedCount} records were skipped (already processed or invalid)`;
          }
          
          alert(message);
        },
        error: (error) => {
          console.error('CSV parse error:', error);
          alert('❌ Error parsing CSV file');
          setImporting(false);
          // Reset file input
          document.querySelector('input[type="file"]').value = '';
        }
      });
    } catch (error) {
      console.error('Error importing CSV:', error);
      const errorMessage = error.message || 'Unknown error';
      alert(`❌ Error reading file\n\n${errorMessage}\n\nPlease make sure the file is a valid CSV file.`);
      setImporting(false);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
    }
  };

  // --- STOCK IMPORT FROM SYSTEM EXPORT ---
  const importStockCSV = async (file) => {
    setImporting(true);
    try {
      const text = await file.text();
      
      Papa.parse(text, {
        skipEmptyLines: true,
        complete: (result) => {
          const data = result.data;
          
          // Skip first 2 rows (date header and empty row)
          // Row 3 is headers: ID, Type, Name, Packages, Package description, Units in the package, Units, Unit description
          // Data starts from row 4
          if (data.length < 4) {
            alert('❌ Invalid file format. Expected stock export CSV.');
            setImporting(false);
            const fileInput = document.querySelector('input[type="file"][data-stock-import]');
            if (fileInput) fileInput.value = '';
            return;
          }
          
          const updatedInventory = { ...inventory };
          let updatedCount = 0;
          const updates = [];
          
          // Process each product row (starting from index 3)
          for (let i = 3; i < data.length; i++) {
            const row = data[i];
            if (row.length < 7) continue; // Skip invalid rows
            
            const productName = row[2]?.trim(); // Column C: Name
            const unitsStr = row[6]?.trim(); // Column G: Units
            
            if (!productName || !unitsStr) continue;
            
            // Parse units (could be decimal like "15.5")
            const units = parseFloat(unitsStr);
            if (isNaN(units)) continue;
            
            // Find matching product in BLOOD_PRODUCTS
            const productKey = Object.keys(BLOOD_PRODUCTS).find(key => key === productName);
            
            if (productKey) {
              if (!updatedInventory[productKey]) {
                updatedInventory[productKey] = {
                  stock: 0,
                  received: 0,
                  used: 0,
                  external: 0,
                  lastUpdated: new Date().toISOString()
                };
              }
              
              // Update stock to the imported value
              updatedInventory[productKey].stock = units;
              updatedInventory[productKey].lastUpdated = new Date().toISOString();
              
              updatedCount++;
              updates.push(`${BLOOD_PRODUCTS[productKey].name_en}: ${units} units`);
            }
          }
          
          if (updatedCount === 0) {
            alert('ℹ️ No matching products found in the CSV file.\n\nMake sure the product names match exactly.');
            setImporting(false);
            const fileInput = document.querySelector('input[type="file"][data-stock-import]');
            if (fileInput) fileInput.value = '';
            return;
          }
          
          // Save updated inventory
          setInventory(updatedInventory);
          saveInventory(updatedInventory, monthlySales);
          
          setImporting(false);
          const fileInput = document.querySelector('input[type="file"][data-stock-import]');
          if (fileInput) fileInput.value = '';
          
          alert(`✅ Stock Import Successful!\n\nUpdated ${updatedCount} products:\n\n${updates.join('\n')}`);
        },
        error: (error) => {
          console.error('CSV parse error:', error);
          alert('❌ Failed to parse CSV file. Please check the format.');
          setImporting(false);
          const fileInput = document.querySelector('input[type="file"][data-stock-import]');
          if (fileInput) fileInput.value = '';
        },
      });
    } catch (error) {
      console.error('Import error:', error);
      alert('❌ Failed to import file: ' + error.message);
      setImporting(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);
      const fileType = file.name.split('.').pop().toLowerCase();
      
      // Reset importing state first
      setImporting(false);
      
      if (fileType === 'csv') {
        importUsageCSV(file);
      } else {
        alert('❌ Unsupported file type. Please select a CSV file.');
      }
    } else {
      console.log('No file selected');
    }
  };

  const deleteImportHistory = (index) => {
    if (confirm('Are you sure you want to delete this import record from history? This will not affect current inventory levels.')) {
      // Simply remove the import from history - don't recalculate inventory
      const updated = monthlySales.filter((_, i) => i !== index);
      
      setMonthlySales(updated);
      saveInventory(inventory, updated); // Keep current inventory as-is
      
      alert('✅ Import record deleted from history. Current inventory levels unchanged.');
    }
  };

  const resetAllData = () => {
    if (confirm('⚠️ WARNING: This will delete ALL inventory data, import history, AND monthly archives.\n\nAre you absolutely sure?')) {
      if (confirm('This action cannot be undone. Continue?')) {
        // Clear all archives
        localStorage.removeItem('inventory_monthly_archives');
        localStorage.removeItem('inventory_last_archive');
        
        // Clear the entire inventory storage (including processedInvoicesByMonth)
        localStorage.removeItem(INVENTORY_STORAGE_KEY);
        
        // Re-initialize fresh inventory
        initializeInventory();
        setProcessedInvoices(new Set());
        setMonthlySales([]);
        setLastCumulativeUsage({});
        
        alert('✅ All data has been reset including archives and processed invoices.');
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

  const forceResetCounters = () => {
    const currentMonth = new Date();
    const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    if (!confirm(`🔄 Reset Month & Start Fresh\n\nThis will:\n• Archive previous month data\n• Reset used/external counters to 0\n• Clear import history for fresh start\n\nContinue?`)) {
      return;
    }

    const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      
      // Get the PREVIOUS month key for archiving
      const lastArchiveDate = localStorage.getItem('inventory_last_archive') || currentMonthKey;
      
      // Archive PREVIOUS month data BEFORE resetting (using lastArchiveDate, not currentMonthKey)
      if (parsed.sales && parsed.sales.length > 0) {
        archiveMonthlyData(lastArchiveDate, parsed.sales);
      }
      
      // Reset counters in localStorage
      if (parsed.current) {
        Object.keys(parsed.current).forEach(key => {
          parsed.current[key].used = 0;
          parsed.current[key].external = 0;
        });
      }
      
      // Reset sales history for new month
      parsed.sales = [];
      
      // Clear processed invoices for CURRENT MONTH ONLY
      const allProcessed = parsed.processedInvoicesByMonth || {};
      allProcessed[currentMonthKey] = []; // Clear current month
      parsed.processedInvoicesByMonth = allProcessed;
      
      // Clear lastCumulativeUsage so next import processes all rows
      delete parsed.lastCumulativeUsage;
      
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(parsed));
      
      // Update the month marker to current month
      localStorage.setItem('inventory_last_archive', currentMonthKey);
      
      // Reset counters in state
      setInventory(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = { ...updated[key], used: 0, external: 0 };
        });
        return updated;
      });
      
      setMonthlySales([]);
      setProcessedInvoices(new Set());
      
      // Reload from localStorage to ensure sync
      loadInventory();
      
      alert(`✅ Month Reset Complete!\n\nPrevious month data has been archived.\nCounters reset to 0.\nReady for new month imports.`);
    }
  };

  const showExternalSalesByMonth = () => {
    // Get archives
    const archivesJson = localStorage.getItem('inventory_monthly_archives');
    const archives = archivesJson ? JSON.parse(archivesJson) : [];
    
    // Also include current month
    const currentMonthExternal = {};
    Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
      const product = inventory[productKey];
      if (product && (product.external || 0) > 0) {
        currentMonthExternal[productKey] = product.external;
      }
    });
    
    if (archives.length === 0 && Object.keys(currentMonthExternal).length === 0) {
      alert('📊 No external sales data available yet.\n\nExternal sales will be tracked when you import usage reports with external sales marked.');
      return;
    }

    // Build list of months with external sales
    const monthsWithExternalSales = [];
    
    // Add current month if has data
    if (Object.keys(currentMonthExternal).length > 0) {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      monthsWithExternalSales.push({
        monthKey: currentMonthKey,
        isCurrent: true,
        data: currentMonthExternal
      });
    }
    
    // Add archived months
    archives.forEach(archive => {
      const externalData = archive.totalExternal || {};
      const totalUnits = Object.values(externalData).reduce((sum, val) => sum + val, 0);
      if (totalUnits > 0) {
        monthsWithExternalSales.push({
          monthKey: archive.month,
          isCurrent: false,
          data: externalData
        });
      }
    });

    if (monthsWithExternalSales.length === 0) {
      alert('No external sales recorded yet.');
      return;
    }

    // Show modal instead of alert
    setShowExternalDetailsModal(true);
  };

  const getExternalUnitsDetails = (monthKey) => {
    // Use Map to prevent duplicates based on unique key (date + animalName + quantity)
    const detailsMap = new Map();
    
    // Check CURRENT month's imports (monthlySales)
    monthlySales.forEach((importRecord) => {
      if (importRecord.externalDetails && importRecord.externalDetails.length > 0) {
        importRecord.externalDetails.forEach(detail => {
          // Use detail.month if available, otherwise calculate from detail.date
          const detailMonth = detail.month || (() => {
            const date = new Date(detail.date);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          })();
          
          // Only include if this detail belongs to the requested month
          if (detailMonth === monthKey) {
            const uniqueKey = `${detail.date}_${detail.animalName}_${detail.quantity}`;
            if (!detailsMap.has(uniqueKey)) {
              detailsMap.set(uniqueKey, {
                date: detail.date,
                animalName: detail.animalName || 'לא צוין',
                ownerName: detail.ownerName || 'לא צוין',
                fileNumber: detail.fileNumber || 'אין',
                productName: detail.productName || BLOOD_PRODUCTS[detail.productKey]?.name_he || 'לא ידוע',
                quantity: Number(detail.quantity || 0).toFixed(2)
              });
            }
          }
        });
      }
    });
    
    // Also check ARCHIVED months
    const archivesJson = localStorage.getItem('inventory_monthly_archives');
    if (archivesJson) {
      const archives = JSON.parse(archivesJson);
      archives.forEach(archive => {
        if (archive.month === monthKey && archive.externalSalesDetails) {
          archive.externalSalesDetails.forEach(detail => {
            const uniqueKey = `${detail.date}_${detail.animalName}_${detail.quantity}`;
            if (!detailsMap.has(uniqueKey)) {
              detailsMap.set(uniqueKey, {
                date: detail.date,
                animalName: detail.animalName || 'לא צוין',
                ownerName: detail.ownerName || 'לא צוין',
                fileNumber: detail.fileNumber || 'אין',
                productName: detail.productName || 'לא ידוע',
                quantity: Number(detail.quantity || 0).toFixed(2)
              });
            }
          });
        }
      });
    }
    
    // Convert Map to array and sort by date (newest first)
    const allDetails = Array.from(detailsMap.values());
    allDetails.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return allDetails;
  };

  const showCurrentMonthStats = () => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Check if there's any usage data at all
    const hasUsageData = Object.values(inventory).some(
      product => (product.used || 0) > 0 || (product.external || 0) > 0
    );
    
    if (!hasUsageData && monthlySales.length === 0) {
      alert('📊 No data available\n\nPlease import a usage report first.');
      return;
    }
    
    // Build stats directly from this month's imports (not from inventory counters)
    const monthUsage = {};
    const monthExternal = {};

    // Only consider imports that belong to the current month (by importDate if exists, otherwise CSV date)
    const salesThisMonth = monthlySales.filter((sale) => {
      const source = sale.importDate || sale.date;
      if (!source) return false;
      const key = (() => {
        const d = new Date(source);
        if (isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();
      return key === currentMonthKey;
    });

    salesThisMonth.forEach((sale) => {
      const externalMap = sale.external || {};
      // Internal usage = delta minus external for each product
      Object.entries(sale.delta || {}).forEach(([key, amount]) => {
        const externalAmount = externalMap[key] || 0;
        const internalAmount = amount - externalAmount;
        if (internalAmount > 0) {
          monthUsage[key] = (monthUsage[key] || 0) + internalAmount;
        }
      });

      // External usage from this import
      Object.entries(externalMap).forEach(([key, amount]) => {
        if (amount > 0) {
          monthExternal[key] = (monthExternal[key] || 0) + amount;
        }
      });
    });
    
    // Get EXTERNAL sales details (for modal and names); totals already from monthExternal
    const externalDetails = getExternalUnitsDetails(currentMonthKey);
    
    // For last 24h - check recent imports by IMPORT DATE (not CSV date)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentImports = monthlySales.filter(sale => {
      // Use importDate if available (new imports), fallback to date for old data
      const checkDate = sale.importDate || sale.date;
      return new Date(checkDate) >= yesterday;
    });
    
    const last24hUsage = {};
    const last24hExternal = {};
    
    recentImports.forEach(sale => {
      // Calculate internal usage (delta minus external)
      Object.entries(sale.delta || {}).forEach(([key, amount]) => {
        const externalAmount = (sale.external && sale.external[key]) || 0;
        const internalAmount = amount - externalAmount;
        if (internalAmount > 0) {
          last24hUsage[key] = (last24hUsage[key] || 0) + internalAmount;
        }
      });
      // Add external sales
      Object.entries(sale.external || {}).forEach(([key, amount]) => {
        last24hExternal[key] = (last24hExternal[key] || 0) + amount;
      });
    });
    
    // Build message - English only
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let message = `📊 Current Month Statistics\n`;
    message += `${monthName}\n`;
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    // CURRENT STATE (total inventory)
    message += `\n📦 CURRENT STATE:\n`;
    const inventoryWithStock = Object.keys(BLOOD_PRODUCTS).filter(key => {
      const product = inventory[key];
      return product && product.stock !== 0;
    });
    
    if (inventoryWithStock.length > 0) {
      inventoryWithStock.forEach(key => {
        const product = inventory[key];
        const bloodProduct = BLOOD_PRODUCTS[key];
        message += `  • ${bloodProduct.name_en}: ${product.stock} units\n`;
      });
      const totalCurrentStock = inventoryWithStock.reduce((sum, key) => sum + (inventory[key].stock || 0), 0);
      message += `  ────────────────\n`;
      message += `  Total Stock: ${totalCurrentStock} units\n`;
    } else {
      message += `No units in stock\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Last 24 Hours
    message += `\n⏰ LAST 24 HOURS:\n`;
    message += `Files imported: ${recentImports.length}\n`;
    if (Object.keys(last24hUsage).length > 0) {
      message += `\nInternal Usage:\n`;
      Object.entries(last24hUsage).forEach(([key, amount]) => {
        message += `  • ${BLOOD_PRODUCTS[key]?.name_en || key}: ${amount} units\n`;
      });
    }
    if (Object.keys(last24hExternal).length > 0) {
      message += `\nExternal Sales:\n`;
      Object.entries(last24hExternal).forEach(([key, amount]) => {
        message += `  • ${BLOOD_PRODUCTS[key]?.name_en || key}: ${amount} units\n`;
      });
    }
    if (Object.keys(last24hUsage).length === 0 && Object.keys(last24hExternal).length === 0) {
      message += `No usage in last 24 hours\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Month to Date - from this month's imports only
    const filesThisMonth = salesThisMonth.length;

    message += `\n� MONTH TO DATE:\n`;
    message += `Files imported this month: ${filesThisMonth}\n`;
    if (Object.keys(monthUsage).length > 0) {
      message += `\nTotal Internal Usage:\n`;
      Object.entries(monthUsage).forEach(([key, amount]) => {
        message += `  • ${BLOOD_PRODUCTS[key]?.name_en || key}: ${amount} units\n`;
      });
    }
    if (Object.keys(monthExternal).length > 0) {
      message += `\nTotal External Sales:\n`;
      Object.entries(monthExternal).forEach(([key, amount]) => {
        message += `  • ${BLOOD_PRODUCTS[key]?.name_en || key}: ${amount} units\n`;
      });
    }
    if (Object.keys(monthUsage).length === 0 && Object.keys(monthExternal).length === 0) {
      message += `No usage this month yet\n`;
    }
    
    // Calculate totals
    const total24h = Object.values(last24hUsage).reduce((sum, v) => sum + v, 0);
    const totalMonthInternal = Object.values(monthUsage).reduce((sum, v) => sum + v, 0);
    const totalMonthExternal = Object.values(monthExternal).reduce((sum, v) => sum + v, 0);
    const totalMonth = totalMonthInternal + totalMonthExternal;
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `\n📊 TOTALS:\n`;
    message += `  Last 24h: ${total24h} units\n`;
    message += `  Month to Date: ${totalMonth} units\n`;
    
    alert(message);
  };

  const getMonthlyExternalSummary = () => {
    // Get current month external units from actual details (same as modal)
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const details = getExternalUnitsDetails(currentMonthKey);
    
    // Calculate total from actual details
    const totalUnits = details.reduce((sum, detail) => sum + parseFloat(detail.quantity), 0);
    
    return { summary: {}, totalExternalRevenue: 0, totalUnits };
  };

  const lowStockProducts = useMemo(() => getLowStockProducts(), [inventory]);
  const negativeStockProducts = useMemo(() => getNegativeStockProducts(), [inventory]);
  const { summary: externalSummary, totalExternalRevenue, totalUnits: totalExternalUnits } = useMemo(() => getMonthlyExternalSummary(), [inventory, monthlySales]);

  return (
    <div className={`min-h-screen ${colors.bg.primary} p-4`}>
      <div className={`max-w-7xl mx-auto ${colors.bg.card} rounded-2xl shadow-lg p-6 ${colors.border.primary} border`}>
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                📦 Blood Inventory Manager
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 rounded-full mb-2"></div>
              <p className={`text-sm ${colors.text.secondary}`}>Import daily usage reports • Update stock manually</p>
            </div>
            
            {/* Main Action Buttons - Responsive Grid */}
            <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
              <button
                onClick={() => setShowImport(true)}
                aria-label="Import medicine usage CSV file"
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-2.5 rounded-xl font-bold hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2"
              >
                <span className="text-lg md:text-xl">�</span>
                <span className="text-xs md:text-sm">Import</span>
              </button>
              
              <button
                onClick={showCurrentMonthStats}
                aria-label="View current month statistics"
                className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-3 py-2.5 rounded-xl font-bold hover:from-teal-600 hover:to-cyan-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2"
              >
                <span className="text-lg md:text-xl">📊</span>
                <span className="text-xs md:text-sm">Current Stats</span>
              </button>
              
              <button
                onClick={showExternalSalesByMonth}
                aria-label="View external sales history by month"
                className="bg-gradient-to-r from-blue-500 to-sky-600 text-white px-3 py-2.5 rounded-xl font-bold hover:from-blue-600 hover:to-sky-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2"
              >
                <span className="text-lg md:text-xl">🏥</span>
                <span className="text-xs md:text-sm">External History</span>
              </button>
              
              <button
                onClick={() => {
                  const archivesJson = localStorage.getItem('inventory_monthly_archives');
                  const archives = archivesJson ? JSON.parse(archivesJson) : [];
                  if (archives.length === 0) {
                    alert('📊 No archived months yet.\n\nMonthly data will be archived when you import historical CSV files.');
                  } else {
                    const archiveList = archives.map((archive, idx) => {
                      const monthDate = new Date(archive.month + '-01');
                      const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      const totalUsage = Object.values(archive.totalUsage || {}).reduce((sum, v) => sum + Number(v), 0);
                      const totalExternal = Object.values(archive.totalExternal || {}).reduce((sum, v) => sum + Number(v), 0);
                      return `${idx + 1}. ${monthName}\n   📦 Total Used: ${totalUsage.toFixed(2)} units\n   🏥 External: ${totalExternal.toFixed(2)} units\n   📄 Records: ${archive.totalRecords || 0}`;
                    }).join('\n\n');
                    alert(`📚 Monthly Archives\n\n${archiveList}\n\n💡 Tip: Data is safely stored and can be exported if needed.`);
                  }
                }}
                aria-label="View monthly archives"
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-2.5 rounded-xl font-bold hover:from-amber-600 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2"
              >
                <span className="text-lg md:text-xl">📚</span>
                <span className="text-xs md:text-sm">View Archives</span>
              </button>
              
              <button
                onClick={forceResetCounters}
                aria-label="Reset current month counters"
                className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-3 py-2.5 rounded-xl font-bold hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2"
              >
                <span className="text-lg md:text-xl">🔄</span>
                <span className="text-xs md:text-sm">Reset Month</span>
              </button>
            </div>
          </div>
          
          {/* Reset Button - Separate and Less Accessible */}
          <div className="flex justify-center md:justify-end">
            <button
              onClick={resetAllData}
              aria-label="Reset all inventory data - warning: destructive action"
              className="bg-gradient-to-r from-gray-400 to-gray-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:from-red-500 hover:to-rose-600 shadow transition-all duration-200 opacity-60 hover:opacity-100"
            >
              🗑️ Reset All Data
            </button>
          </div>
        </div>

        {/* Compact Summary Bar */}
        <div className={`${colors.bg.card} rounded-xl shadow-lg p-3 mb-6 border ${colors.border.primary}`}>
          <div className="flex justify-around items-center text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">{getTotalStock()}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Units</div>
            </div>
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{lowStockProducts.length}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Low Stock</div>
            </div>
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
            <div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{monthlySales.length}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Reports</div>
            </div>
          </div>
        </div>

        {/* Inventory Table - All Products */}
        <div className={`${colors.bg.card} rounded-xl shadow-lg overflow-hidden border ${colors.border.primary}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-indigo-500 to-purple-600">
                <tr>
                  <th className="text-left p-3 text-white text-sm font-bold">Product</th>
                  <th className="text-center p-3 text-white text-sm font-bold">Stock</th>
                  <th className="text-center p-3 text-white text-sm font-bold">In</th>
                  <th className="text-center p-3 text-white text-sm font-bold">Out</th>
                  <th className="text-center p-3 text-white text-sm font-bold">External</th>
                  <th className="text-center p-3 text-white text-sm font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Dog Products */}
                <tr 
                  className="bg-blue-50 dark:bg-blue-900/40 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                  onClick={() => setShowDogProducts(!showDogProducts)}
                >
                  <td colSpan="6" className="p-3 text-sm font-bold text-gray-700 dark:text-blue-200">
                    <div className="flex items-center justify-between">
                      <span>🐶 Dog Blood Products</span>
                      <span className="text-lg">{showDogProducts ? '▼' : '▶'}</span>
                    </div>
                  </td>
                </tr>
                {showDogProducts && Object.keys(BLOOD_PRODUCTS)
                  .filter((productKey) => {
                    const product = BLOOD_PRODUCTS[productKey];
                    if (product.species !== 'dog') return false;
                    // Hide products with zero activity
                    const stock = inventory[productKey] || { stock: 0, received: 0, used: 0, external: 0 };
                    return stock.stock !== 0 || stock.received !== 0 || stock.used !== 0 || stock.external !== 0;
                  })
                  .map((productKey) => {
                    const product = BLOOD_PRODUCTS[productKey];
                    const stock = inventory[productKey] || { stock: 0, received: 0, used: 0, external: 0 };
                    const displayStock = Math.max(0, stock.stock);
                    const displayReceived = Math.max(0, stock.received);
                    const displayUsed = Math.max(0, stock.used);
                    const displayExternal = Math.max(0, stock.external || 0);
                    const isLow = stock.stock < LOW_STOCK_THRESHOLD && stock.stock >= 0;
                    const isNegative = stock.stock < 0;
                    
                    return (
                      <tr key={productKey} className={`border-b ${colors.border.secondary} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors bg-white dark:bg-gray-950`}>
                        <td className="p-3">
                          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{product.name_en}</div>
                          {(isLow || isNegative) && (
                            <div className="text-xs font-bold mt-1 text-gray-600 dark:text-gray-400">
                              {isNegative ? '⚠️ Negative!' : '⚠️ Low'}
                            </div>
                          )}
                        </td>
                        <td className="text-center p-3">
                          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                            {displayStock}
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <div className={`text-lg font-bold ${displayReceived > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {displayReceived > 0 ? `+${displayReceived}` : '0'}
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <div className={`text-lg font-bold ${displayUsed > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {displayUsed > 0 ? `-${displayUsed}` : '0'}
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <div className={`text-lg font-bold ${displayExternal > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {displayExternal > 0 ? displayExternal : '0'}
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <button
                            onClick={() => {
                              setSetValue(String(displayStock));
                              setSetProductKey(productKey);
                              setShowSetModal(true);
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all"
                          >
                            SET
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                
                {/* Cat Products */}
                <tr 
                  className="bg-orange-50 dark:bg-orange-900/40 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors"
                  onClick={() => setShowCatProducts(!showCatProducts)}
                >
                  <td colSpan="6" className="p-3 text-sm font-bold text-gray-700 dark:text-orange-200">
                    <div className="flex items-center justify-between">
                      <span>🐱 Cat Blood Products</span>
                      <span className="text-lg">{showCatProducts ? '▼' : '▶'}</span>
                    </div>
                  </td>
                </tr>
                {showCatProducts && Object.keys(BLOOD_PRODUCTS)
                  .filter((productKey) => {
                    const product = BLOOD_PRODUCTS[productKey];
                    if (product.species !== 'cat') return false;
                    // Hide products with zero activity
                    const stock = inventory[productKey] || { stock: 0, received: 0, used: 0, external: 0 };
                    return stock.stock !== 0 || stock.received !== 0 || stock.used !== 0 || stock.external !== 0;
                  })
                  .map((productKey) => {
                    const product = BLOOD_PRODUCTS[productKey];
                    const stock = inventory[productKey] || { stock: 0, received: 0, used: 0, external: 0 };
                    const displayStock = Math.max(0, stock.stock);
                    const displayReceived = Math.max(0, stock.received);
                    const displayUsed = Math.max(0, stock.used);
                    const displayExternal = Math.max(0, stock.external || 0);
                    const isLow = stock.stock < LOW_STOCK_THRESHOLD && stock.stock >= 0;
                    const isNegative = stock.stock < 0;
                    
                    return (
                      <tr key={productKey} className={`border-b ${colors.border.secondary} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors bg-white dark:bg-gray-950`}>
                        <td className="p-3">
                          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{product.name_en}</div>
                          {(isLow || isNegative) && (
                            <div className="text-xs font-bold mt-1 text-gray-600 dark:text-gray-400">
                              {isNegative ? '⚠️ Negative!' : '⚠️ Low'}
                            </div>
                          )}
                        </td>
                        <td className="text-center p-3">
                          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                            {displayStock}
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <div className={`text-lg font-bold ${displayReceived > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {displayReceived > 0 ? `+${displayReceived}` : '0'}
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <div className={`text-lg font-bold ${displayUsed > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {displayUsed > 0 ? `-${displayUsed}` : '0'}
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <div className={`text-lg font-bold ${displayExternal > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {displayExternal > 0 ? displayExternal : '0'}
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <button
                            onClick={() => {
                              setSetValue(String(displayStock));
                              setSetProductKey(productKey);
                              setShowSetModal(true);
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all"
                          >
                            SET
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

      {/* SET Modal (global) */}
      {showSetModal && setProductKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSetModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 min-w-[260px] max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <div className="mb-4 text-lg font-bold text-indigo-700 dark:text-indigo-300">Set stock for {BLOOD_PRODUCTS[setProductKey].name_en}</div>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className="w-full border-2 border-indigo-400 rounded-lg p-3 text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 dark:bg-gray-800"
              value={setValue}
              onChange={e => setSetValue(e.target.value.replace(/[^0-9.,]/g, ''))}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSetModal(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold">Cancel</button>
              <button
                onClick={() => {
                  if (setValue !== '') {
                    const numeric = parseFloat(String(setValue).replace(',', '.'));
                    if (!isNaN(numeric)) {
                      updateStock(setProductKey, numeric, 'received');
                    }
                    setShowSetModal(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white font-bold hover:bg-blue-600"
              >Set</button>
            </div>
          </div>
        </div>
      )}

        {/* Inventory Cards - Separated by Species */}
        <div className="space-y-8 hidden">
        </div>

        {/* External Sales at Bottom */}
        {totalExternalUnits > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowExternalDetailsModal(true)}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span className="text-2xl">🏥</span>
              <span>View External Sales Details ({totalExternalUnits.toFixed(1)} units this month)</span>
            </button>
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
                    🗑️ Remove
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
            <div className={`${colors.bg.card} rounded-3xl shadow-2xl p-8 max-w-2xl w-full border-2 ${colors.border.primary}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="text-4xl">📥</div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Import Data</h3>
              </div>
              
              {/* Two import options */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Option 1: Usage Report */}
                <div className={`p-6 border-2 rounded-xl ${colors.border.primary} hover:border-indigo-500 transition-all`}>
                  <div className="text-3xl mb-3">📊</div>
                  <h4 className="text-lg font-bold mb-2">Medicine Usage Report</h4>
                  <p className={`text-xs ${colors.text.secondary} mb-4 leading-relaxed`}>
                    Import daily/weekly usage to track deductions from stock
                  </p>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileSelect}
                    disabled={importing}
                    className={`w-full p-3 border-2 border-dashed rounded-lg ${colors.border.primary} hover:border-indigo-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200`}
                  />
                </div>
                
                {/* Option 2: Stock List */}
                <div className={`p-6 border-2 rounded-xl ${colors.border.primary} hover:border-green-500 transition-all`}>
                  <div className="text-3xl mb-3">📦</div>
                  <h4 className="text-lg font-bold mb-2">Stock List Export</h4>
                  <p className={`text-xs ${colors.text.secondary} mb-4 leading-relaxed`}>
                    Import current stock levels directly from system
                  </p>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    data-stock-import
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        importStockCSV(file);
                      }
                    }}
                    disabled={importing}
                    className={`w-full p-3 border-2 border-dashed rounded-lg ${colors.border.primary} hover:border-green-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200`}
                  />
                </div>
              </div>

              {importing && (
                <div className="text-center py-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl mb-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-3"></div>
                  <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Importing data...</p>
                  <button
                    onClick={() => {
                      setImporting(false);
                      const fileInputs = document.querySelectorAll('input[type="file"]');
                      fileInputs.forEach(input => input.value = '');
                    }}
                    className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                  >
                    Cancel Import
                  </button>
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

      {/* External Sales Details Modal */}
      {showExternalDetailsModal && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-40" onClick={() => setShowExternalDetailsModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className={`${colors.bg.card} rounded-3xl shadow-2xl p-8 max-w-4xl w-full border-2 ${colors.border.primary} my-8`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">🏥</div>
                  <h3 className={`text-3xl font-bold bg-gradient-to-r from-blue-600 to-sky-600 bg-clip-text text-transparent`}>External Sales - Select Month</h3>
                </div>
                <button
                  onClick={() => setShowExternalDetailsModal(false)}
                  className={`text-3xl ${colors.text.secondary} hover:text-red-600 transition-colors`}
                >
                  ×
                </button>
              </div>

              {/* Month selection buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  // Get archives
                  const archivesJson = localStorage.getItem('inventory_monthly_archives');
                  const archives = archivesJson ? JSON.parse(archivesJson) : [];
                  
                  // Get current month external data
                  const currentMonthExternal = {};
                  Object.keys(BLOOD_PRODUCTS).forEach(productKey => {
                    const product = inventory[productKey];
                    if (product && (product.external || 0) > 0) {
                      currentMonthExternal[productKey] = product.external;
                    }
                  });

                  // Use Map to prevent duplicates and aggregate data by month
                  const monthsMap = new Map();
                  const now = new Date();
                  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                  // Add current month if has data
                  if (Object.keys(currentMonthExternal).length > 0) {
                    // Calculate actual total from details instead of inventory totals
                    const details = getExternalUnitsDetails(currentMonthKey);
                    const totalUnits = details.reduce((sum, detail) => sum + parseFloat(detail.quantity), 0);
                    
                    monthsMap.set(currentMonthKey, {
                      monthKey: currentMonthKey,
                      totalUnits,
                      isCurrent: true
                    });
                  }

                  // Add archived months - calculate from actual details
                  archives.forEach(archive => {
                    const details = getExternalUnitsDetails(archive.month);
                    const totalUnits = details.reduce((sum, detail) => sum + parseFloat(detail.quantity), 0);
                    
                    if (totalUnits > 0) {
                      const existing = monthsMap.get(archive.month);
                      if (existing) {
                        // This shouldn't happen anymore with deduplication, but keep for safety
                        existing.totalUnits = totalUnits;
                      } else {
                        // New month
                        monthsMap.set(archive.month, {
                          monthKey: archive.month,
                          totalUnits,
                          isCurrent: archive.month === currentMonthKey
                        });
                      }
                    }
                  });

                  // Convert Map to array and sort by month (newest first)
                  const monthsWithData = Array.from(monthsMap.values());
                  monthsWithData.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

                  return monthsWithData.map((monthData) => {
                    const monthDate = new Date(monthData.monthKey + '-01');
                    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    const details = getExternalUnitsDetails(monthData.monthKey);
                    const isSelected = selectedExternalMonth === monthData.monthKey;
                    
                    // Count sales: if we have detailed records use that, otherwise estimate from total units
                    const salesCount = details.length > 0 ? details.length : Math.ceil(monthData.totalUnits);
                    
                    return (
                      <button
                        key={monthData.monthKey}
                        onClick={() => setSelectedExternalMonth(monthData.monthKey)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <div className="text-right">
                          <div className={`font-bold text-lg ${
                            isSelected 
                              ? 'text-blue-900 dark:text-blue-100' 
                              : colors.text.primary
                          }`}>
                            {monthName} {monthData.isCurrent && '(Current)'}
                          </div>
                          <div className={`text-sm ${
                            isSelected 
                              ? 'text-blue-700 dark:text-blue-200' 
                              : colors.text.secondary
                          }`}>
                            {monthData.totalUnits.toFixed(1)} units • {salesCount} sales
                          </div>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Details for selected month */}
              {selectedExternalMonth && (
                <div className="mt-6 border-t pt-6 border-gray-200 dark:border-gray-700">
                  <h4 className={`text-xl font-bold mb-4 ${colors.text.primary}`}>
                    Sales Details - {new Date(selectedExternalMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h4>
                  <div className="space-y-4 max-h-96 overflow-y-auto">{(() => {
                      const details = getExternalUnitsDetails(selectedExternalMonth);
                      
                      if (details.length === 0) {
                        return (
                          <div className="text-center py-12 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-300 dark:border-yellow-700">
                            <div className="text-4xl mb-3">⚠️</div>
                            <p className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">No Owner Details</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                              Previous imports were made before the fix and didn't save animal and owner details
                            </p>
                            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700 max-w-md mx-auto text-center">
                              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 Solution:</p>
                              <p className="text-xs text-blue-700 dark:text-blue-300">
                                Re-import the Medicine Usage CSV file for this month.<br/>
                                This time all details (animal name, owner name, file number) will be saved.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      
                      return details.map((sale, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-2 gap-3 text-left mb-3">
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Date</div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">{sale.date}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Animal Name</div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">{sale.animalName}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Owner Name</div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">{sale.ownerName}</div>
                          </div>
                        </div>
                        <div className="border-t pt-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Unit Sold:</div>
                          <div className="flex flex-wrap gap-2">
                            <div className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-lg text-sm">
                              <span className="font-semibold">{sale.productName}</span>
                              <span className="text-blue-600 dark:text-blue-400 ml-2">×{sale.quantity}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ));
                    })()}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowExternalDetailsModal(false);
                    setSelectedExternalMonth(null);
                  }}
                  className="bg-gradient-to-r from-gray-400 to-gray-500 text-white px-6 py-3 rounded-xl font-bold hover:from-gray-500 hover:to-gray-600 shadow-lg transition-all"
                >
                  Close
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
