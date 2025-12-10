import Papa from 'papaparse';

/**
 * Parse CSV file and normalize data
 * @param {File} file - CSV file to parse
 * @returns {Promise<Array>} Parsed and normalized data
 */
export const parseCsvFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false, // Don't use header auto-detection
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        try {
          // Find the actual header row (looks for "Invoice date" or "Date" column)
          let headerRowIndex = -1;
          let headers = [];
          
          for (let i = 0; i < Math.min(results.data.length, 10); i++) {
            const row = results.data[i];
            if (Array.isArray(row)) {
              // Check if this row contains header keywords
              const rowStr = row.join('|').toLowerCase();
              if (rowStr.includes('invoice date') || 
                  (rowStr.includes('date') && (rowStr.includes('name') || rowStr.includes('quantity')))) {
                headerRowIndex = i;
                headers = row;
                console.log('📋 Found header row at index:', i, '→', headers);
                break;
              }
            }
          }
          
          if (headerRowIndex === -1) {
            throw new Error('לא נמצאה שורת headers בקובץ');
          }
          
          // Convert to object format using the found headers
          const dataRows = results.data.slice(headerRowIndex + 1);
          const objectData = dataRows
            .filter(row => Array.isArray(row) && row.length >= headers.length)
            .map(row => {
              const obj = {};
              headers.forEach((header, index) => {
                obj[header] = row[index] || '';
              });
              return obj;
            });
          
          console.log('📦 Parsed', objectData.length, 'data rows');
          
          const normalizedData = normalizeData(objectData);
          resolve(normalizedData);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

/**
 * Normalize data based on detected format
 * @param {Array} data - Raw CSV data
 * @returns {Array} Normalized data
 */
const normalizeData = (data) => {
  if (data.length === 0) return [];

  // Detect if this is sales data or medicine usage data
  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  // Check for sales data indicators
  const isSalesData = columns.some(col => 
    col.toLowerCase().includes('invoice') || 
    col.toLowerCase().includes('patient') ||
    col.toLowerCase().includes('price') ||
    col.toLowerCase().includes('total')
  );

  // Check for medicine usage indicators
  const isMedicineData = columns.some(col => 
    col.toLowerCase().includes('medicine') || 
    col.toLowerCase().includes('usage') ||
    col.toLowerCase().includes('dispensed') ||
    col.toLowerCase().includes('batch')
  );

  if (isSalesData) {
    return normalizeSalesData(data);
  } else if (isMedicineData) {
    return normalizeMedicineData(data);
  } else {
    // Generic normalization
    return normalizeGenericData(data);
  }
};

/**
 * Normalize sales data (ITEM SALES format)
 */
const normalizeSalesData = (data) => {
  return data
    .filter(row => {
      // Filter out summary rows and empty data
      const date = row['Date'] || row['Invoice date'] || row['Column1'];
      return date && 
             !date.includes('total') && 
             !date.includes('Total') &&
             (date.includes('-') || date.includes('/')) && // Date format check
             row['Name'] || row['Column2']; // Has product name
    })
    .map(row => ({
      id: generateId(),
      type: 'sale',
      date: parseDate(row['Date'] || row['Invoice date'] || row['Column1']),
      productName: row['Name'] || row['Column2'] || '',
      productCode: row['Code'] || row['Column3'] || '',
      quantity: parseFloat(row['Quantity'] || row['Column4']) || 0,
      priceExclVat: parseFloat(row['Price excl. VAT'] || row['Price excl.'] || row['Column5']) || 0,
      totalExclVat: parseFloat(row['Total excl. VAT'] || row['Total excl.'] || row['Column6']) || 0,
      totalInclVat: parseFloat(row['Total incl. VAT'] || row['Column7']) || 0,
      patientId: row['Patient ID'] || row['Column8'] || '',
      patientName: row['Patient Name'] || row['Column9'] || '',
      patientSpecies: row['Patient Species'] || row['Column10'] || '',
      patientBreed: row['Patient Breed'] || row['Column11'] || '',
      clientId: row['Client ID'] || row['Column16'] || '',
      clientName: row['Client Name'] || row['Column17'] || '',
      clientAddress: row['Client Address'] || row['Column18'] || '',
      clientPhone: row['Client Mobile Number'] || row['Column20'] || '',
      clientEmail: row['Client Email Address'] || row['Column21'] || '',
      invoiceNumber: row['Invoice #'] || row['Column22'] || '',
      notes: ''
    }));
};

/**
 * Normalize medicine usage data
 */
const normalizeMedicineData = (data) => {
  return data
    .filter(row => {
      // Filter out summary rows
      const timestamp = row['Created timestamp'] || row['Column2'];
      return timestamp && 
             timestamp.includes('2025') && // Valid timestamp
             (row['Medicine'] || row['Column4']); // Has medicine name
    })
    .map(row => ({
      id: generateId(),
      type: 'medicine_usage',
      date: parseDate(row['Used timestamp'] || row['Column3']),
      createdDate: parseDate(row['Created timestamp'] || row['Column2']),
      medicine: row['Medicine'] || row['Column4'] || '',
      batchNumber: row['Batch number'] || row['Column5'] || '',
      expiryDate: parseDate(row['Expiry Date'] || row['Column6']),
      quantityPackages: parseFloat(row['Quantity (packages)'] || row['Column7']) || 0,
      quantityUnits: parseFloat(row['Quantity (units)'] || row['Column8']) || 0,
      usageType: row['Usage type'] || row['Column9'] || '',
      clientName: row['Client'] || row['Column10'] || '',
      clientAddress: row['Client Address'] || row['Column11'] || '',
      patientName: row['Patient name'] || row['Column12'] || '',
      patientSpecies: row['Patient species'] || row['Column13'] || '',
      patientBreed: row['Patient breed'] || row['Column14'] || '',
      veterinarian: row['Veterinarian'] || row['Column15'] || '',
      clinicLocation: row['Clinic location'] || row['Column16'] || '',
      notes: ''
    }));
};

/**
 * Generic data normalization for unknown formats
 */
const normalizeGenericData = (data) => {
  return data.map((row, index) => ({
    id: generateId(),
    type: 'generic',
    date: new Date().toISOString().split('T')[0],
    rawData: row,
    index: index + 1,
    notes: ''
  }));
};

/**
 * Parse date string to YYYY-MM-DD format
 */
const parseDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    // Remove time portion if exists (e.g., "10/19/2025 09:20" -> "10/19/2025")
    const dateOnly = dateString.split(' ')[0];
    
    // Handle ISO format with timezone
    if (dateString.includes('+') || dateString.includes('T')) {
      return new Date(dateString).toISOString().split('T')[0];
    }
    
    // Handle MM/DD/YYYY or DD/MM/YYYY format
    if (dateOnly.includes('/')) {
      const parts = dateOnly.split('/');
      if (parts.length === 3) {
        let month, day, year;
        
        // Try to determine if it's MM/DD/YYYY or DD/MM/YYYY
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        year = parts[2];
        
        // If first number > 12, it must be DD/MM/YYYY
        if (first > 12) {
          day = parts[0].padStart(2, '0');
          month = parts[1].padStart(2, '0');
        }
        // If second number > 12, it must be MM/DD/YYYY
        else if (second > 12) {
          month = parts[0].padStart(2, '0');
          day = parts[1].padStart(2, '0');
        }
        // Ambiguous - assume MM/DD/YYYY (American format)
        else {
          month = parts[0].padStart(2, '0');
          day = parts[1].padStart(2, '0');
        }
        
        return `${year}-${month}-${day}`;
      }
    }
    
    // Try to parse as-is
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    
    return '';
  } catch (error) {
    console.warn('Date parsing failed:', error);
    return '';
  }
};

/**
 * Generate unique ID
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Export data to CSV format
 * @param {Array} data - Data to export
 * @param {string} filename - Target filename
 */
export const exportToCsv = (data, filename = 'export.csv') => {
  if (!data || data.length === 0) {
    alert('אין נתונים לייצוא');
    return;
  }

  const csv = Papa.unparse(data, {
    header: true,
    encoding: 'UTF-8'
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Get summary statistics from data
 * @param {Array} data - Data to analyze
 * @returns {Object} Summary statistics
 */
export const getDataSummary = (data) => {
  if (!data || data.length === 0) {
    return { total: 0, types: {}, dateRange: null };
  }

  const summary = {
    total: data.length,
    types: {},
    dateRange: { start: null, end: null },
    totalRevenue: 0,
    totalQuantity: 0
  };

  data.forEach(item => {
    // Count by type
    const type = item.type || 'unknown';
    summary.types[type] = (summary.types[type] || 0) + 1;

    // Calculate date range
    if (item.date) {
      const date = new Date(item.date);
      if (!summary.dateRange.start || date < new Date(summary.dateRange.start)) {
        summary.dateRange.start = item.date;
      }
      if (!summary.dateRange.end || date > new Date(summary.dateRange.end)) {
        summary.dateRange.end = item.date;
      }
    }

    // Calculate totals
    if (item.totalInclVat) {
      summary.totalRevenue += item.totalInclVat;
    }
    if (item.quantity) {
      summary.totalQuantity += item.quantity;
    }
    if (item.quantityUnits) {
      summary.totalQuantity += item.quantityUnits;
    }
  });

  return summary;
};