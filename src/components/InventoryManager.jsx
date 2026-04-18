import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';

/**
 * INVENTORY MANAGER - COMPLETE REBUILD
 * 
 * Core Principles:
 * - Data integrity first: No double counting, no data loss
 * - Idempotent operations: Re-uploading files doesn't change results
 * - File deletion doesn't affect ingested data
 * - Deterministic external unit classification
 * - Correct month boundary handling
 * - Dark mode with proper contrast
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'blood_inventory_v2';
const EXTERNAL_KEYWORD = 'חיצוני'; // Hebrew: "External"

// Blood product definitions (English names for UI)
const PRODUCT_DEFINITIONS = {
  'fresh_blood_dog': 'Fresh Whole Blood Dog',
  'whole_blood_dog': 'Whole Blood Dog',
  'whole_blood_cat': 'Whole Blood Cat',
  'plasma_dog': 'Plasma Dog',
  'plasma_cat': 'Plasma Cat',
  'prbc_dog': 'pRBC Dog',
  'prbc_cat': 'pRBC Cat',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize product name from CSV to standard key
 * Handles ALL variations of Hebrew/English product names
 */
function normalizeProductName(csvName) {
  if (!csvName) return null;
  
  const lower = csvName.toLowerCase().trim();
  // Helper: check if string contains animal type
  const isDog = lower.includes('dog') || lower.includes('כלב');
  const isCat = lower.includes('cat') || lower.includes('חתול');
  
  // ========== FRESH BLOOD DOG ==========
  // Patterns: "דם טרי כלב", "fresh blood dog", "mdm dog fresh", "מנת דם טרי כלב"
  if (isDog && (
    lower.includes('fresh') || 
    lower.includes('טרי') ||
    (lower.includes('mdm') && lower.includes('fresh'))
  )) {
    return 'fresh_blood_dog';
  }
  
  // ========== WHOLE BLOOD DOG ==========
  // Patterns: "דם מלא כלב", "whole blood dog", "mdm dog", "מנת דם מלא כלב"
  if (isDog && (
    lower.includes('mdm') || 
    lower.includes('whole') ||
    lower.includes('מלא')
  ) && !lower.includes('fresh') && !lower.includes('טרי')) {
    return 'whole_blood_dog';
  }
  
  // ========== WHOLE BLOOD CAT ==========
  // Patterns: "דם מלא חתול", "whole blood cat", "mdm cat", "מנת דם מלא חתול"
  if (isCat && (
    lower.includes('mdm') || 
    lower.includes('whole') ||
    lower.includes('מלא')
  )) {
    return 'whole_blood_cat';
  }
  
  // ========== PLASMA DOG ==========
  // Patterns: "פלסמה כלב", "plasma dog", "mdp dog", "מנת דם פלסמה כלב"
  if (isDog && (
    lower.includes('mdp') || 
    lower.includes('plasma') ||
    lower.includes('פלסמה')
  )) {
    return 'plasma_dog';
  }
  
  // ========== PLASMA CAT ==========
  // Patterns: "פלסמה חתול", "plasma cat", "mdp cat", "מנת דם פלסמה חתול"
  if (isCat && (
    lower.includes('mdp') || 
    lower.includes('plasma') ||
    lower.includes('פלסמה')
  )) {
    return 'plasma_cat';
  }
  
  // ========== pRBC/PACKED CELLS DOG ==========
  // Patterns: "תרכיז תאים כלב", "prbc dog", "packed cells dog", "mdtt dog", "mdttbig dog", "mdttsmall dog"
  if (isDog && (
    lower.includes('mdtt') || 
    lower.includes('prbc') ||
    lower.includes('prc') ||
    lower.includes('packed') ||
    lower.includes('תרכיז')
  )) {
    return 'prbc_dog';
  }
  
  // ========== pRBC/PACKED CELLS CAT ==========
  // Patterns: "תרכיז תאים חתול", "prbc cat", "packed cells cat", "mdtt cat", "mdttbig cat", "mdttsmall cat"
  if (isCat && (
    lower.includes('mdtt') || 
    lower.includes('prbc') ||
    lower.includes('prc') ||
    lower.includes('packed') ||
    lower.includes('תרכיז')
  )) {
    return 'prbc_cat';
  }
  
  return null;
}

/**
 * Check if a blood unit is "external" (contains Hebrew word חיצוני)
 * Handles all variations: with quotes, spaces, hyphens, etc.
 */
function isExternalUnit(csvName) {
  if (!csvName) return false;
  const lower = csvName.toLowerCase();
  
  // Primary check: Does "חיצוני" appear anywhere in the string?
  // This is the most reliable check regardless of surrounding characters
  if (lower.includes(EXTERNAL_KEYWORD)) {
    return true;
  }
  
  // Fallback checks for encoding issues, typos, and variations
  const fallbackPatterns = [
    'external',
    'ציצוני',        // Without leading ח
    'חצוני',         // Typo variant
    '"חיצוני',       // With double quote at start
    'חיצוני"',       // With double quote at end
    "'חיצוני",       // With single quote at start
    "חיצוני'",       // With single quote at end
    '- חיצוני',      // With hyphen-space prefix
    ' - חיצוני',     // With space-hyphen-space prefix
    'חיצוני -',      // With space-hyphen suffix
    '" חיצוני "',    // With quotes and spaces
  ];
  
  for (const pattern of fallbackPatterns) {
    if (lower.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate unique identifier for a blood unit
 * Uses Invoice row # as primary key, falls back to composite hash
 */
function generateUnitId(row, rowIndex) {
  // Medicine Usage CSV has "Invoice row #" which is globally unique
  const invoiceRow = row['Invoice row #'] || row.invoice_row || '';
  
  if (invoiceRow && invoiceRow.trim()) {
    // Invoice row # is the best unique identifier
    return `invoice_${invoiceRow.trim()}`;
  }
  
  // Fallback: create composite key from all available fields
  const date = row['Used timestamp'] || row.date || row.Date || '';
  const medicine = row.Medicine || row.product || row.Product || '';
  const quantity = row['Quantity (units)'] || row.quantity || '';
  const client = row.Client || '';
  const patient = row['Patient name'] || '';
  
  // Create composite key with all distinguishing fields
  const composite = `${date}|${medicine}|${quantity}|${client}|${patient}|${rowIndex}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < composite.length; i++) {
    const char = composite.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `unit_${Math.abs(hash)}`;
}

/**
 * Parse date from CSV (handles various formats)
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // Try ISO format first
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  return null;
}

/**
 * Get month key from date (YYYY-MM format)
 */
function getMonthKey(dateStr) {
  if (!dateStr) return null;
  return dateStr.substring(0, 7); // YYYY-MM-DD -> YYYY-MM
}

/**
 * Get current month key
 */
function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get month start date
 */
function getMonthStart(monthKey) {
  return `${monthKey}-01`;
}

/**
 * Get today's date (YYYY-MM-DD)
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// DATA MODEL
// ============================================================================

/**
 * Initialize empty data structure
 */
function initializeData() {
  return {
    // Map of unique unit IDs to unit records
    // { unitId: { id, date, productKey, isExternal, quantity, sourceFile, parsedAt } }
    units: {},
    
    // Map of uploaded file references
    // { fileId: { id, name, uploadedAt, type, rowCount } }
    files: {},
    
    // Latest inventory snapshot
    // { date, productKey: count, ... }
    inventorySnapshot: null,
    inventorySnapshotDate: null,
    
    // Metadata
    version: 2,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Load data from localStorage
 */
function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initializeData();
    
    const parsed = JSON.parse(stored);
    
    // Validate structure
    if (!parsed.units || !parsed.files) {
      console.warn('Invalid data structure, reinitializing');
      return initializeData();
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to load data:', error);
    return initializeData();
  }
}

/**
 * Save data to localStorage
 */
function saveData(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to save data:', error);
    return false;
  }
}

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Aggregate units by product and period
 */
function aggregateUnits(units, startDate, endDate) {
  const result = {
    byProduct: {},
    externalByProduct: {},
    total: 0,
    totalExternal: 0,
  };
  
  Object.values(units).forEach(unit => {
    // Filter by date range
    if (startDate && unit.date < startDate) return;
    if (endDate && unit.date > endDate) return;
    
    const productKey = unit.productKey;
    const quantity = unit.quantity || 1;
    
    if (unit.isExternal) {
      result.externalByProduct[productKey] = (result.externalByProduct[productKey] || 0) + quantity;
      result.totalExternal += quantity;
    } else {
      result.byProduct[productKey] = (result.byProduct[productKey] || 0) + quantity;
      result.total += quantity;
    }
  });
  
  return result;
}

/**
 * Get daily summary (group by date)
 */
function getDailySummary(units, startDate, endDate) {
  const dailyMap = {};
  
  Object.values(units).forEach(unit => {
    if (startDate && unit.date < startDate) return;
    if (endDate && unit.date > endDate) return;
    
    const date = unit.date;
    if (!dailyMap[date]) {
      dailyMap[date] = { date, byProduct: {}, externalByProduct: {}, total: 0, totalExternal: 0 };
    }
    
    const productKey = unit.productKey;
    const quantity = unit.quantity || 1;
    
    if (unit.isExternal) {
      dailyMap[date].externalByProduct[productKey] = (dailyMap[date].externalByProduct[productKey] || 0) + quantity;
      dailyMap[date].totalExternal += quantity;
    } else {
      dailyMap[date].byProduct[productKey] = (dailyMap[date].byProduct[productKey] || 0) + quantity;
      dailyMap[date].total += quantity;
    }
  });
  
  // Convert to sorted array
  return Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get monthly summary (group by month)
 */
function getMonthlySummary(units) {
  const monthlyMap = {};
  
  Object.values(units).forEach(unit => {
    const monthKey = getMonthKey(unit.date);
    if (!monthKey) return;
    
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { month: monthKey, byProduct: {}, externalByProduct: {}, total: 0, totalExternal: 0 };
    }
    
    const productKey = unit.productKey;
    const quantity = unit.quantity || 1;
    
    if (unit.isExternal) {
      monthlyMap[monthKey].externalByProduct[productKey] = (monthlyMap[monthKey].externalByProduct[productKey] || 0) + quantity;
      monthlyMap[monthKey].totalExternal += quantity;
    } else {
      monthlyMap[monthKey].byProduct[productKey] = (monthlyMap[monthKey].byProduct[productKey] || 0) + quantity;
      monthlyMap[monthKey].total += quantity;
    }
  });
  
  // Convert to sorted array (most recent first)
  return Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Calculate current inventory from snapshot and usage
 */
function calculateCurrentInventory(data) {
  if (!data.inventorySnapshot) {
    return { byProduct: {}, snapshotDate: null };
  }
  
  // Start with snapshot
  const current = { ...data.inventorySnapshot };
  
  // Subtract usage after snapshot date
  Object.values(data.units).forEach(unit => {
    if (unit.date > data.inventorySnapshotDate) {
      const productKey = unit.productKey;
      const quantity = unit.quantity || 1;
      current[productKey] = (current[productKey] || 0) - quantity;
    }
  });
  
  return { byProduct: current, snapshotDate: data.inventorySnapshotDate };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const InventoryManager = () => {
  const { isDarkMode } = useTheme();
  
  // State
  // Initialize lazily from storage to avoid race conditions with auto-save
  const [data, setData] = useState(() => loadData());
  const [selectedView, setSelectedView] = useState('overview'); // overview | daily | monthly | mtd
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  
  // Auto-save when data changes
  useEffect(() => {
    // Save even if empty (to support deleting all data)
    // Structure check prevents saving uninitialized bad state
    if (data && data.units && data.files) {
      saveData(data);
    }
  }, [data]);
  
  // ============================================================================
  // CSV IMPORT HANDLERS
  // ============================================================================
  
  /**
   * Handle usage CSV upload
   * Assumes CSV columns: date, unit_id, product_name, location, etc.
   */
  const handleUsageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportProgress('Reading file...');
    
    try {
      // Read as ArrayBuffer and auto-detect encoding by comparing Hebrew character counts
      const buffer = await file.arrayBuffer();
      const utf8Text = new TextDecoder('utf-8').decode(buffer);
      let win1255Text = '';
      try {
        win1255Text = new TextDecoder('windows-1255').decode(buffer);
      } catch {}
      // Improved heuristic: prefer base Hebrew letters over diacritic marks to avoid mojibake
      const hebrewLettersRegex = /[\u05D0-\u05EA]/g; // base letters א-ת
      const hebrewMarksRegex = /[\u0591-\u05C7]/g;  // cantillation/niqqud marks
      const count = (s, re) => (s.match(re) || []).length;
      const utf8Letters = count(utf8Text, hebrewLettersRegex);
      const utf8Marks = count(utf8Text, hebrewMarksRegex);
      const winLetters = count(win1255Text, hebrewLettersRegex);
      const winMarks = count(win1255Text, hebrewMarksRegex);

      // Penalize common mojibake sequence frequency (e.g., "ֳ—") often seen in mis-decoded Win-1255
      const mojibakePattern = /\u05B3\u2014/g; // ֳ—
      const utf8Mojibake = (utf8Text.match(mojibakePattern) || []).length;
      const winMojibake = (win1255Text.match(mojibakePattern) || []).length;

      // Compute a score: letters minus half marks minus mojibake penalty
      const scoreUtf8 = utf8Letters - 0.5 * utf8Marks - utf8Mojibake;
      const scoreWin = winLetters - 0.5 * winMarks - winMojibake;

      let text = utf8Text;
      let chosen = 'UTF-8';
      if (win1255Text && scoreWin > scoreUtf8) {
        text = win1255Text;
        chosen = 'Windows-1255';
      }
      // Secondary recovery: if we see many '×' characters (classic mojibake), try Latin1→UTF8 repair
      const xCount = (text.match(/×/g) || []).length;
      if (xCount > 50) {
        const bytes = new Uint8Array(Array.from(text).map(ch => ch.charCodeAt(0) & 0xFF));
        try {
          const repaired = new TextDecoder('utf-8').decode(bytes);
          const repairedLetters = (repaired.match(/[\u05D0-\u05EA]/g) || []).length;
          const currentLetters = (text.match(/[\u05D0-\u05EA]/g) || []).length;
          if (repairedLetters > currentLetters) {
            text = repaired;
          }
        } catch {}
      }
      
      // Debug: Show first 500 characters of raw file
      // Medicine Usage exports have 4-5 metadata rows before the real headers
      // Find the row that starts with "Invoice row #" and parse from there
      const lines = text.split('\n');
      const headerIndex = lines.findIndex(line => line.startsWith('Invoice row #'));
      
      if (headerIndex === -1) {
        alert('Could not find header row starting with "Invoice row #". Is this a Medicine Usage export?');
        setImporting(false);
        setImportProgress('');
        event.target.value = '';
        return;
      }
      
      // Rejoin from the header row onwards
      const cleanedText = lines.slice(headerIndex).join('\n');
      
      Papa.parse(cleanedText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processUsageCSV(results.data, file.name);
        },
        error: (error) => {
          alert(`CSV parse error: ${error.message}`);
          setImporting(false);
          setImportProgress('');
        }
      });
    } catch (error) {
      alert(`Failed to read file: ${error.message}`);
      setImporting(false);
      setImportProgress('');
    }
    
    // Reset input
    event.target.value = '';
  };
  
  /**
   * Process usage CSV data
   */
  const processUsageCSV = (rows, fileName) => {
    setImportProgress('Processing rows...');
    
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let newUnits = 0;
    let duplicates = 0;
    let skippedNoDate = 0;
    let skippedUnknownProduct = 0;
    let skippedEmpty = 0;
    const uniqueProducts = new Set(); // Track unique product names
    
    // Debug: Show available columns
    if (rows.length > 0) {
    }
    
    setData(prevData => {
      const updated = { ...prevData };
      const newUnitsMap = { ...updated.units };
      
      rows.forEach((row, index) => {
        // Debug first 10 rows to see what's really there
        if (index < 10) {
          const hasContent = Object.values(row).some(v => v && v.toString().trim());
        }
        
        // Skip empty rows
        if (!row || Object.keys(row).length === 0 || !Object.values(row).some(v => v && v.toString().trim())) {
          skippedEmpty++;
          return;
        }
        
        // First capture product name (for unique list) even if row later skipped
        const productNameEarly = row.Medicine || row._2 || row.product || row.Product || row.product_name || row['Product Name'] || '';
        if (index < 10) {
          const codes = typeof productNameEarly === 'string' ? Array.from(productNameEarly).map(ch => ch.codePointAt(0)) : [];
        }
        if (productNameEarly) uniqueProducts.add(productNameEarly);

        // Parse row - support multiple CSV formats
        // Medicine Usage format: 'Used timestamp', 'Medicine', 'Quantity (units)'
        // But Papa Parse may rename duplicate headers to _1, _2, etc.
        // Generic format: 'date', 'product', 'quantity'
        const dateStr = row['Used timestamp'] || row._1 || row.date || row.Date || row.DATE || '';
        
        // Skip header rows that contain column names instead of data
        if (dateStr === 'Used timestamp' || dateStr === 'date' || dateStr === 'Date') {
          skippedEmpty++;
          return;
        }
        
        if (!dateStr) {
          skippedNoDate++;
          return;
        }
        
        const date = parseDate(dateStr);
        if (!date) {
          skippedNoDate++;
          return;
        }
        
        const productName = productNameEarly;
        
        if (!productName) {
          skippedUnknownProduct++;
          return;
        }
        
        const productKey = normalizeProductName(productName);
        if (!productKey) {
          skippedUnknownProduct++;
          return;
        }
        
        const isExternal = isExternalUnit(productName);
        const quantityStr = row['Quantity (units)'] || row._6 || row.quantity || row.Quantity || '';
        const quantity = quantityStr === '' ? 1 : parseFloat(quantityStr);
        
        // Skip units with 0 quantity (not used)
        if (quantity === 0 || isNaN(quantity)) {
          if (index < 20) {
          }
          skippedEmpty++;
          return;
        }
        
        // Log first few successful recognitions with external status
        if (index < 20) {
        }
        
        // Generate unique unit ID
        const unitId = generateUnitId(row, index);
        
        // Check if already exists (deduplication)
        if (newUnitsMap[unitId]) {
          duplicates++;
          return;
        }
        
        // Add new unit
        newUnitsMap[unitId] = {
          id: unitId,
          date,
          productKey,
          isExternal,
          quantity,
          sourceFile: fileId,
          parsedAt: new Date().toISOString(),
        };
        
        newUnits++;
        
        // Log first few successful units
        if (newUnits <= 3) {
        }
        
        // Debug on very first unit
        if (newUnits === 1) {
        }
      });
      
      // Add file reference
      updated.files[fileId] = {
        id: fileId,
        name: fileName,
        uploadedAt: new Date().toISOString(),
        type: 'usage',
        rowCount: rows.length,
      };
      
      updated.units = newUnitsMap;
      
      // Count external units
      const externalCount = Object.values(newUnitsMap).filter(u => u.isExternal).length;
      const regularCount = Object.values(newUnitsMap).length - externalCount;
      // Show unique product names found in file
      // Show alert with results
      setTimeout(() => {
        const message = `✅ Import complete!\n\nNew units: ${newUnits}\nDuplicates: ${duplicates}\nSkipped - Empty rows: ${skippedEmpty}\nSkipped - No date: ${skippedNoDate}\nSkipped - Unknown product: ${skippedUnknownProduct}\n\nFile: ${fileName}`;
        alert(message);
        setImportProgress('');
        setImporting(false);
      }, 100);
      
      return updated;
    });
  };
  
  /**
   * Handle inventory snapshot upload
   */
  const handleSnapshotUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportProgress('Reading inventory snapshot...');
    
    try {
      const text = await file.text();
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processSnapshotCSV(results.data, file.name);
        },
        error: (error) => {
          alert(`CSV parse error: ${error.message}`);
          setImporting(false);
        }
      });
    } catch (error) {
      alert(`Failed to read file: ${error.message}`);
      setImporting(false);
    }
    
    // Reset input
    event.target.value = '';
  };
  
  /**
   * Process inventory snapshot CSV
   */
  const processSnapshotCSV = (rows, fileName) => {
    const snapshot = {};
    const snapshotDate = getTodayDate();
    
    rows.forEach(row => {
      const productName = row.product || row.Product || row.product_name || '';
      const productKey = normalizeProductName(productName);
      if (!productKey) return;
      
      const count = parseInt(row.count || row.Count || row.quantity || row.Quantity || 0);
      snapshot[productKey] = count;
    });
    
    setData(prevData => ({
      ...prevData,
      inventorySnapshot: snapshot,
      inventorySnapshotDate: snapshotDate,
    }));
    
    setImportProgress('');
    setImporting(false);
    
    alert(`✅ Inventory snapshot updated!\n\nDate: ${snapshotDate}\nProducts: ${Object.keys(snapshot).length}`);
  };
  
  /**
   * Delete file and all its ingested data
   */
  const handleDeleteFile = (fileId) => {
    const file = data.files[fileId];
    if (!file) return;
    
    // Count units from this file
    const unitsFromFile = Object.values(data.units).filter(u => u.sourceFile === fileId);
    const unitCount = unitsFromFile.length;
    
    if (!confirm(`Delete file and all its data?\n\n${file.name}\n\n${unitCount} units will be permanently deleted.`)) {
      return;
    }
    
    setData(prevData => {
      const updated = { ...prevData };
      
      // Remove file reference
      const newFiles = { ...updated.files };
      delete newFiles[fileId];
      updated.files = newFiles;
      
      // Remove all units from this file
      const newUnits = {};
      Object.entries(updated.units).forEach(([unitId, unit]) => {
        if (unit.sourceFile !== fileId) {
          newUnits[unitId] = unit;
        }
      });
      updated.units = newUnits;
      
      return updated;
    });
    
    alert(`✅ Deleted ${file.name} and ${unitCount} units`);
  };

  /**
   * Clear all inventory data (Emergency Reset)
   */
  const handleClearAllData = () => {
    if (confirm('⚠️ Are you sure you want to delete ALL inventory data?')) {
      if (confirm('🔴 Final Warning: This cannot be undone. All usage history and stock data will be erased.')) {
        const resetData = initializeData();
        setData(resetData);
        saveData(resetData);
        alert('🗑️ All inventory data has been permanently deleted.');
      }
    }
  };
  
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  const currentInventory = calculateCurrentInventory(data);
  const currentMonthKey = getCurrentMonthKey();
  const monthStart = getMonthStart(currentMonthKey);
  const today = getTodayDate();
  
  // Overall totals (all time)
  const overallTotals = aggregateUnits(data.units, null, null);
  
  // Month-to-date (current month)
  const mtdTotals = aggregateUnits(data.units, monthStart, today);
  
  // Daily breakdown
  const dailySummary = getDailySummary(data.units, null, null);
  
  // Monthly breakdown
  const monthlySummary = getMonthlySummary(data.units);
  
  // File list
  const fileList = Object.values(data.files).sort((a, b) => 
    new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className={`min-h-screen p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'}`}>
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className={`text-xl font-bold mb-1 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent`}>
              Inventory Usage
            </h1>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Track blood product usage with zero data loss and correct aggregation
            </p>
          </div>
          <button
            onClick={handleClearAllData}
            className="px-2 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors border border-red-200 dark:border-red-800"
          >
            🗑️ Reset
          </button>
        </div>
        
        {/* Import Section */}
        <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Import Data
            </h2>
            {Object.keys(data.units).length > 0 && (
              <button
                onClick={handleClearAllData}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors border border-red-300 dark:border-red-800"
              >
                🗑️ Clear All ({Object.keys(data.units).length} units)
              </button>
            )}
          </div>
          
          <div className="flex gap-4">
            {/* Usage Button */}
            <div className="relative">
              <input
                id="usageFileInput"
                type="file"
                accept="*/*"
                onChange={handleUsageUpload}
                disabled={importing}
                className="hidden"
              />
              <label
                htmlFor="usageFileInput"
                className={`block px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all ${
                  importing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow hover:shadow-md transform hover:scale-[1.01]'
                }`}
              >
                📊 USAGE
              </label>
            </div>
            
            {/* Stock Button */}
            <div className="relative">
              <input
                id="stockFileInput"
                type="file"
                accept="*/*"
                onChange={handleSnapshotUpload}
                disabled={importing}
                className="hidden"
              />
              <label
                htmlFor="stockFileInput"
                className={`block px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all ${
                  importing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow hover:shadow-md transform hover:scale-[1.01]'
                }`}
              >
                📦 STOCK
              </label>
            </div>
          </div>
          
          {importing && (
            <div className="mt-4 px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
              {importProgress}
            </div>
          )}
        </div>
        
        {/* Summary Toggle */}
        <div className="mb-6">
          <button
            onClick={() => setSelectedView(selectedView === 'overview' ? 'monthly' : 'overview')}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow hover:shadow-md transform hover:scale-[1.01] transition-all"
          >
            {selectedView === 'overview' ? '📊 Show Monthly History' : '📋 Show Overview'}
          </button>
        </div>
        
        {/* Content Views */}
        {selectedView === 'overview' && (
          <OverviewView
            isDarkMode={isDarkMode}
            overallTotals={overallTotals}
            mtdTotals={mtdTotals}
            currentMonthKey={currentMonthKey}
            currentInventory={currentInventory}
            fileList={fileList}
            onDeleteFile={handleDeleteFile}
            allUnits={data.units}
          />
        )}
        
        {selectedView === 'monthly' && (
          <MonthlySummaryView
            isDarkMode={isDarkMode}
            monthlySummary={monthlySummary}
          />
        )}
        
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Overview View
 */
const OverviewView = ({ isDarkMode, overallTotals, mtdTotals, currentMonthKey, currentInventory, fileList, onDeleteFile, allUnits }) => {
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonthKey);
  
  // Generate list of available months from unit data
  const availableMonths = React.useMemo(() => {
    const months = new Set();
    Object.values(allUnits).forEach(unit => {
      if (unit.date) {
        const monthKey = unit.date.substring(0, 7); // YYYY-MM
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse();
  }, [allUnits]);
  
  // Calculate selected month data
  const selectedMonthData = React.useMemo(() => {
    const monthStart = selectedMonth + '-01';
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().substring(0, 10);
    
    return aggregateUnits(allUnits, monthStart, monthEnd);
  }, [selectedMonth, allUnits]);
  
  return (
  <div className="space-y-6">
    
    {/* Month Selector and Summary */}
    <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} border`}>
      <h2 className={`text-base font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
        Monthly Usage Summary
      </h2>
      
      {/* Month Selector */}
      <div className="mb-4">
        <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Select Month
        </label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className={`w-full md:w-64 px-4 py-2 rounded-lg border ${
            isDarkMode 
              ? 'bg-gray-700 border-gray-600 text-white' 
              : 'bg-white border-gray-300 text-gray-800'
          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        >
          {availableMonths.map(month => (
            <option key={month} value={month}>
              {new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </option>
          ))}
        </select>
      </div>
      
      {/* Month Statistics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {selectedMonthData.total}
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300">
            Regular Units
          </div>
        </div>
        
        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {selectedMonthData.totalExternal}
          </div>
          <div className="text-xs text-purple-700 dark:text-purple-300">
            External Units
          </div>
        </div>
      </div>
      
      {/* Product Breakdown for Selected Month */}
      <ProductBreakdownTable
        isDarkMode={isDarkMode}
        byProduct={selectedMonthData.byProduct}
        externalByProduct={selectedMonthData.externalByProduct}
        compact
      />
    </div>
    
    {/* Current Inventory */}
    {currentInventory.snapshotDate && (
      <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} border`}>
        <h2 className={`text-base font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Current Inventory
        </h2>
        <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Based on snapshot from {currentInventory.snapshotDate}
        </p>
        
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                <th className={`text-left py-1 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  Product
                </th>
                <th className={`text-right py-1 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(currentInventory.byProduct).map(([productKey, count]) => (
                <tr key={productKey} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <td className={`py-1 px-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {PRODUCT_DEFINITIONS[productKey] || productKey}
                  </td>
                  <td className={`py-1 px-2 text-right font-semibold ${count < 0 ? 'text-red-400' : count < 5 ? 'text-orange-400' : isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
    
    {/* Uploaded Files */}
    <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} border`}>
      <h2 className={`text-base font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
        Uploaded Files
      </h2>
      
      {fileList.length === 0 ? (
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No files uploaded yet
        </p>
      ) : (
        <div className="space-y-2">
          {fileList.map(file => (
            <div
              key={file.id}
              className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}
            >
              <div className="flex-1">
                <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {file.name}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Uploaded: {new Date(file.uploadedAt).toLocaleString()} · {file.rowCount} rows
                </div>
              </div>
              <button
                onClick={() => onDeleteFile(file.id)}
                className="ml-4 px-3 py-1 rounded-lg text-sm font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    
  </div>
);
};

/**
 * Daily Summary View
 */
const DailySummaryView = ({ colors, dailySummary }) => (
  <div className="space-y-4">
    <div className="p-6 rounded-lg" style={{ 
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.border}` 
    }}>
      <h2 className="text-xl font-bold mb-4" style={{ color: colors.text }}>
        Daily Usage Summary
      </h2>
      
      {dailySummary.length === 0 ? (
        <p className="text-sm" style={{ color: colors.subtext }}>
          No usage data available
        </p>
      ) : (
        <div className="space-y-6">
          {dailySummary.map(day => (
            <div key={day.date} className="border-b pb-4" style={{ borderColor: colors.border }}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-lg" style={{ color: colors.text }}>
                  {new Date(day.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="text-sm font-semibold" style={{ color: colors.subtext }}>
                  Total: {day.total} units {day.totalExternal > 0 && `(+${day.totalExternal} external)`}
                </div>
              </div>
              
              <ProductBreakdownTable
                colors={colors}
                byProduct={day.byProduct}
                externalByProduct={day.externalByProduct}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

/**
 * Monthly Summary View
 */
const MonthlySummaryView = ({ isDarkMode, monthlySummary }) => {
  const [expandedMonths, setExpandedMonths] = React.useState(new Set());
  
  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };
  
  return (
    <div className="space-y-4">
      <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} border`}>
        <h2 className={`text-base font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Historical Monthly Summary
        </h2>
        
        {monthlySummary.length === 0 ? (
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No usage data available
          </p>
        ) : (
          <div className="space-y-3">
            {monthlySummary.map(month => {
              const isExpanded = expandedMonths.has(month.month);
              const monthName = new Date(month.month + '-01').toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long' 
              });
              
              return (
                <div key={month.month} className={`border rounded-lg overflow-hidden ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  {/* Month Header - Clickable */}
                  <button
                    onClick={() => toggleMonth(month.month)}
                    className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
                      isDarkMode 
                        ? 'bg-gray-700 hover:bg-gray-600' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        ▶
                      </span>
                      <span className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                        {monthName}
                      </span>
                    </div>
                    <div className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {month.total} units {month.totalExternal > 0 && `+ ${month.totalExternal} external`}
                    </div>
                  </button>
                  
                  {/* Month Details - Expandable */}
                  {isExpanded && (
                    <div className={`px-4 py-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                      <ProductBreakdownTable
                        isDarkMode={isDarkMode}
                        byProduct={month.byProduct}
                        externalByProduct={month.externalByProduct}
                        compact
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Month-to-Date View
 */
const MTDView = ({ colors, mtdTotals, monthKey }) => (
  <div className="space-y-4">
    <div className="p-6 rounded-lg" style={{ 
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.border}` 
    }}>
      <h2 className="text-xl font-bold mb-2" style={{ color: colors.text }}>
        Month-to-Date Usage
      </h2>
      <p className="text-sm mb-4" style={{ color: colors.subtext }}>
        {new Date(monthKey + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} (Start to Today)
      </p>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {mtdTotals.total}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            Regular Units
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {mtdTotals.totalExternal}
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-300">
            External Units
          </div>
        </div>
      </div>
      
      <ProductBreakdownTable
        colors={colors}
        title="Product Breakdown"
        byProduct={mtdTotals.byProduct}
        externalByProduct={mtdTotals.externalByProduct}
      />
    </div>
  </div>
);

/**
 * Product Breakdown Table (Reusable)
 */
const ProductBreakdownTable = ({ isDarkMode, title, byProduct, externalByProduct, compact }) => {
  const allProducts = new Set([
    ...Object.keys(byProduct),
    ...Object.keys(externalByProduct),
  ]);
  
  if (allProducts.size === 0) {
    return (
      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        No products to display
      </div>
    );
  }
  
  return (
    <div className={compact ? '' : `p-6 rounded-lg ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} border`}>
      {title && (
        <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          {title}
        </h3>
      )}
      
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <th className={`text-left py-1 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Product
              </th>
              <th className={`text-right py-1 px-1 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Reg
              </th>
              <th className={`text-right py-1 px-1 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Ext
              </th>
              <th className={`text-right py-1 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from(allProducts).sort().map(productKey => {
              const regular = byProduct[productKey] || 0;
              const external = externalByProduct[productKey] || 0;
              const total = regular + external;
              
              return (
                <tr key={productKey} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <td className={`py-1 px-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {PRODUCT_DEFINITIONS[productKey] || productKey}
                  </td>
                  <td className={`py-1 px-1 text-right font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {regular}
                  </td>
                  <td className="py-1 px-1 text-right font-semibold text-purple-600 dark:text-purple-400">
                    {external}
                  </td>
                  <td className={`py-1 px-2 text-right font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {total}
                  </td>
                </tr>
              );
            })}
            
            {/* Totals Row */}
            <tr className={`border-t-2 font-bold ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <td className={`py-1 px-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                TOTAL
              </td>
              <td className={`py-1 px-1 text-right ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {Object.values(byProduct).reduce((sum, val) => sum + val, 0)}
              </td>
              <td className="py-1 px-1 text-right text-purple-600 dark:text-purple-400">
                {Object.values(externalByProduct).reduce((sum, val) => sum + val, 0)}
              </td>
              <td className={`py-1 px-2 text-right ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {Object.values(byProduct).reduce((sum, val) => sum + val, 0) + 
                 Object.values(externalByProduct).reduce((sum, val) => sum + val, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryManager;
