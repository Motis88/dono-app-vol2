import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Supported file types
export const SUPPORTED_FILE_TYPES = ['.csv', '.xlsx', '.xls', '.json'];

// Expected data model schema
export const REQUIRED_FIELDS = ['date', 'productName', 'quantity', 'price'];
export const OPTIONAL_FIELDS = ['month', 'total'];

// Hebrew translations
export const HEBREW_LABELS = {
  date: 'תאריך',
  month: 'חודש', 
  productName: 'מוצר',
  quantity: 'כמות',
  price: 'מחיר',
  total: 'סה״כ',
  summary: 'סיכום',
  files: 'קבצים',
  records: 'רשומות',
  revenue: 'הכנסה',
  error: 'שגיאה',
  unsupportedFormat: 'פורמט לא נתמך',
  missingColumns: 'עמודות חסרות',
  invalidData: 'נתונים לא תקינים'
};

// Field mappings - common variations of field names
export const FIELD_MAPPINGS = {
  date: ['date', 'תאריך', 'datum', 'fecha', 'data'],
  month: ['month', 'חודש', 'mes', 'mois'],
  productName: ['productName', 'product', 'מוצר', 'שם מוצר', 'item', 'name'],
  quantity: ['quantity', 'כמות', 'qty', 'amount', 'count'],
  price: ['price', 'מחיר', 'cost', 'unitPrice', 'pricePerUnit'],
  total: ['total', 'סה״כ', 'totalPrice', 'totalCost', 'sum']
};

/**
 * Validates if a file type is supported
 */
export function validateFileType(fileName) {
  const extension = '.' + fileName.split('.').pop().toLowerCase();
  return SUPPORTED_FILE_TYPES.includes(extension);
}

/**
 * Normalizes month format to YYYY-MM
 */
export function normalizeMonth(dateStr) {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date)) return null;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  } catch (error) {
    return null;
  }
}

/**
 * Normalizes product name (trim, case, spacing)
 */
export function normalizeProductName(name) {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Maps raw field names to normalized field names
 */
export function mapFieldNames(rawData) {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    return { data: [], fieldMap: {} };
  }

  const sampleRow = rawData[0];
  const rawFields = Object.keys(sampleRow);
  const fieldMap = {};
  
  // Create mapping from raw fields to normalized fields
  // Use exact match first, then partial match
  Object.entries(FIELD_MAPPINGS).forEach(([normalizedField, variations]) => {
    if (fieldMap[normalizedField]) return; // Already mapped
    
    // Try exact match first
    let matchedField = rawFields.find(rawField => 
      variations.includes(rawField.toLowerCase())
    );
    
    // If no exact match, try contains match but be careful about conflicts
    if (!matchedField) {
      matchedField = rawFields.find(rawField => {
        return variations.some(variation => {
          // For 'price' field, don't match if field contains 'total'
          if (normalizedField === 'price' && rawField.toLowerCase().includes('total')) {
            return false;
          }
          // For 'total' field, don't match if field is just 'price'
          if (normalizedField === 'total' && rawField.toLowerCase() === 'price') {
            return false;
          }
          return rawField.toLowerCase().includes(variation.toLowerCase());
        });
      });
    }
    
    if (matchedField && !Object.values(fieldMap).includes(normalizedField)) {
      fieldMap[matchedField] = normalizedField;
    }
  });

  // If no mapping found, use original field names if they exist in REQUIRED_FIELDS
  rawFields.forEach(field => {
    if (REQUIRED_FIELDS.includes(field) && !fieldMap[field]) {
      fieldMap[field] = field;
    }
  });

  // Transform data using field mapping
  const mappedData = rawData.map(row => {
    const normalizedRow = {};
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = fieldMap[key] || key;
      normalizedRow[normalizedKey] = value;
    });
    return normalizedRow;
  });

  return { data: mappedData, fieldMap };
}

/**
 * Validates data schema and returns missing fields
 */
export function validateDataSchema(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { isValid: false, missingFields: REQUIRED_FIELDS, errors: ['No data found'] };
  }

  const sampleRow = data[0];
  const availableFields = Object.keys(sampleRow);
  const missingFields = REQUIRED_FIELDS.filter(field => !availableFields.includes(field));
  
  const errors = [];
  if (missingFields.length > 0) {
    errors.push(`Missing required fields: ${missingFields.join(', ')}`);
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    errors,
    availableFields
  };
}

/**
 * Normalizes and validates a single data row
 */
export function normalizeDataRow(row) {
  const normalized = {
    date: row.date ? new Date(row.date).toISOString().split('T')[0] : null,
    month: normalizeMonth(row.date),
    productName: normalizeProductName(row.productName),
    quantity: parseFloat(row.quantity) || 0,
    price: parseFloat(row.price) || 0,
    total: 0
  };

  // Calculate total if not provided
  if (row.total) {
    normalized.total = parseFloat(row.total) || 0;
  } else {
    normalized.total = normalized.quantity * normalized.price;
  }

  // Create unique key for deduplication
  normalized._key = `${normalized.date}_${normalized.productName.toLowerCase()}_${normalized.quantity}_${normalized.price}`;

  return normalized;
}

/**
 * Deduplicates data by unique key
 */
export function deduplicateData(data) {
  const seen = new Set();
  return data.filter(row => {
    if (seen.has(row._key)) {
      return false;
    }
    seen.add(row._key);
    return true;
  });
}

/**
 * Parses file content based on file type
 */
export async function parseFileContent(file) {
  return new Promise((resolve, reject) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let rawData = null;
        
        if (fileExtension === 'json') {
          rawData = JSON.parse(e.target.result);
          if (!Array.isArray(rawData)) {
            throw new Error('JSON file must contain an array of objects');
          }
        } else if (fileExtension === 'csv') {
          const parsed = Papa.parse(e.target.result, { 
            header: true, 
            skipEmptyLines: true,
            encoding: 'UTF-8'
          });
          if (parsed.errors.length > 0) {
            throw new Error(`CSV parsing error: ${parsed.errors[0].message}`);
          }
          rawData = parsed.data;
        } else if (['xlsx', 'xls'].includes(fileExtension)) {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          rawData = XLSX.utils.sheet_to_json(sheet);
        } else {
          throw new Error(`Unsupported file type: ${fileExtension}`);
        }

        resolve(rawData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('File reading failed'));

    if (['xlsx', 'xls'].includes(fileExtension)) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'UTF-8'); // Ensure UTF-8 encoding
    }
  });
}

/**
 * Main function to process uploaded file
 */
export async function processUploadedFile(file) {
  try {
    // Validate file type
    if (!validateFileType(file.name)) {
      throw new Error(`${HEBREW_LABELS.unsupportedFormat}: ${file.name}. Supported formats: ${SUPPORTED_FILE_TYPES.join(', ')}`);
    }

    // Parse file content
    const rawData = await parseFileContent(file);
    
    // Map field names
    const { data: mappedData, fieldMap } = mapFieldNames(rawData);
    
    // Validate schema
    const validation = validateDataSchema(mappedData);
    if (!validation.isValid) {
      throw new Error(`${HEBREW_LABELS.missingColumns}: ${validation.missingFields.join(', ')}`);
    }

    // Normalize data
    const normalizedData = mappedData.map(normalizeDataRow);
    
    // Deduplicate
    const deduplicatedData = deduplicateData(normalizedData);

    // Calculate summary
    const summary = {
      fileName: file.name,
      recordCount: deduplicatedData.length,
      duplicatesRemoved: normalizedData.length - deduplicatedData.length,
      totalQuantity: deduplicatedData.reduce((sum, row) => sum + row.quantity, 0),
      totalRevenue: deduplicatedData.reduce((sum, row) => sum + row.total, 0),
      uniqueProducts: new Set(deduplicatedData.map(row => row.productName)).size,
      monthsSpanned: new Set(deduplicatedData.map(row => row.month).filter(Boolean)).size,
      fieldMapping: fieldMap
    };

    return {
      success: true,
      data: deduplicatedData,
      summary,
      validation
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: [],
      summary: null
    };
  }
}