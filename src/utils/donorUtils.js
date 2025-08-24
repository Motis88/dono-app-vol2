import { v4 as uuidv4 } from 'uuid';

/**
 * Check if a name is meaningful (contains letters, not just digits)
 * @param {string} name - Name to check
 * @returns {boolean} True if meaningful, false otherwise
 */
export const isMeaningfulName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const hasLetters = /[A-Za-z\u0590-\u05FF]/.test(name);
  const onlyDigits = /^\d+$/.test(name.trim());
  return hasLetters && !onlyDigits;
};

/**
 * Normalize donors by adding IDs if missing
 * @param {Array} donors - Array of donor objects
 * @returns {Array} Array of normalized donors with IDs
 */
export const normalizeDonors = (donors) => {
  if (!Array.isArray(donors)) {
    console.warn('normalizeDonors: Expected array, got:', typeof donors);
    return [];
  }

  return donors.map((donor) => {
    if (!donor || typeof donor !== 'object') {
      console.warn('normalizeDonors: Invalid donor object:', donor);
      return { id: uuidv4(), ...donor };
    }

    if (donor.id) return donor;

    const { animalType, animalName = "", ownerName = "" } = donor;
    const isCat = animalType?.toLowerCase() === "cat";
    const hasGoodName = isMeaningfulName(animalName);
    
    if (isCat && !hasGoodName) {
      return { ...donor, id: uuidv4() };
    }
    
    const baseId = `${animalName.trim().toLowerCase()}_${ownerName.trim().toLowerCase()}`;
    return { ...donor, id: baseId };
  });
};

/**
 * Remove exact duplicates from donors array
 * @param {Array} donors - Array of donor objects
 * @returns {Array} Array without exact duplicates
 */
export const removeExactDuplicates = (donors) => {
  if (!Array.isArray(donors)) {
    console.warn('removeExactDuplicates: Expected array, got:', typeof donors);
    return [];
  }

  const seen = new Set();
  const serialize = (d) => {
    if (!d || typeof d !== 'object') return '';
    
    try {
      return JSON.stringify({
        animalName: d.animalName,
        date: d.date,
        location: d.location,
        age: d.age,
        weight: d.weight,
        gender: d.gender,
        animalType: d.animalType,
        bloodType: d.bloodType,
        pcv: d.pcv,
        hct: d.hct,
        wbc: d.wbc,
        plt: d.plt,
        fiv: d.fiv,
        felv: d.felv,
        packedCell: d.packedCell,
        slideFindings: d.slideFindings,
        donated: d.donated,
        volume: d.volume,
        notes: d.notes,
      });
    } catch (error) {
      console.warn('Error serializing donor for duplicate check:', error);
      return JSON.stringify(d);
    }
  };

  return donors.filter(d => {
    const key = serialize(d);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Validate donor data
 * @param {Object} donor - Donor object to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateDonor = (donor) => {
  const errors = [];
  
  if (!donor || typeof donor !== 'object') {
    errors.push('Donor must be an object');
    return { isValid: false, errors };
  }

  // Required fields validation
  if (!donor.animalName || !donor.animalName.trim()) {
    errors.push('Animal name is required');
  }

  if (!donor.animalType || !donor.animalType.trim()) {
    errors.push('Animal type is required');
  }

  if (!donor.location || !donor.location.trim()) {
    errors.push('Location is required');
  }

  if (!donor.date || !donor.date.trim()) {
    errors.push('Date is required');
  } else {
    // Validate date format
    const date = new Date(donor.date);
    if (isNaN(date.getTime())) {
      errors.push('Date must be in valid format');
    }
  }

  // Optional numeric field validation
  const numericFields = ['age', 'weight', 'pcv', 'hct', 'wbc', 'plt', 'packedCell', 'volume'];
  numericFields.forEach(field => {
    if (donor[field] && donor[field] !== '') {
      const num = parseFloat(donor[field]);
      if (isNaN(num) || num < 0) {
        errors.push(`${field} must be a positive number`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Sanitize donor data to prevent XSS and other issues
 * @param {Object} donor - Donor object to sanitize
 * @returns {Object} Sanitized donor object
 */
export const sanitizeDonor = (donor) => {
  if (!donor || typeof donor !== 'object') {
    return {};
  }

  const sanitized = {};
  
  // Sanitize string fields
  const stringFields = [
    'animalName', 'ownerName', 'location', 'animalType', 'bloodType',
    'gender', 'fiv', 'felv', 'donated', 'slideFindings', 'notes'
  ];
  
  stringFields.forEach(field => {
    if (donor[field] !== undefined && donor[field] !== null) {
      // Basic XSS prevention - remove script tags and normalize whitespace
      sanitized[field] = String(donor[field])
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    } else {
      sanitized[field] = '';
    }
  });

  // Handle numeric fields
  const numericFields = ['age', 'weight', 'pcv', 'hct', 'wbc', 'plt', 'packedCell', 'volume'];
  numericFields.forEach(field => {
    if (donor[field] !== undefined && donor[field] !== null && donor[field] !== '') {
      const num = parseFloat(donor[field]);
      sanitized[field] = isNaN(num) ? '' : String(num);
    } else {
      sanitized[field] = '';
    }
  });

  // Handle date field
  if (donor.date) {
    const date = new Date(donor.date);
    sanitized.date = isNaN(date.getTime()) ? '' : donor.date;
  } else {
    sanitized.date = '';
  }

  // Handle boolean field
  sanitized.isPrivateOwner = Boolean(donor.isPrivateOwner);

  // Preserve ID if it exists
  if (donor.id) {
    sanitized.id = String(donor.id);
  }

  return sanitized;
};

/**
 * Check if animal should be highlighted based on donation eligibility
 * @param {Object} donor - Donor object
 * @param {Array} removedHighlights - Array of removed highlight IDs
 * @returns {boolean} True if should be highlighted
 */
export const isAnimalHighlighted = (donor, removedHighlights = []) => {
  if (!donor || typeof donor !== 'object') return false;
  
  const type = donor.animalType?.toLowerCase();
  if (!type || (type !== "dog" && type !== "cat")) return false;
  
  if (!donor.animalName || !isMeaningfulName(donor.animalName)) return false;
  
  if (!donor.date) return false;
  
  const donationDate = new Date(donor.date);
  if (isNaN(donationDate)) return false;
  
  const nextEligible = new Date(donationDate);
  nextEligible.setDate(nextEligible.getDate() + 90);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextEligible.setHours(0, 0, 0, 0);
  
  const diffDays = Math.round((today - nextEligible) / (1000 * 60 * 60 * 24));
  
  // Highlight 7 days before up to 14 days after
  const shouldHighlight = diffDays >= -7 && diffDays <= 14;
  
  // Check if highlight was manually removed
  const highlightId = donor.id || `${donor.animalName}_${donor.date}`;
  const isRemoved = removedHighlights.includes(highlightId);
  
  return shouldHighlight && !isRemoved;
};