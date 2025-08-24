import { STORAGE_KEYS } from './constants.js';

/**
 * Safe JSON parsing with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} Parsed object or fallback value
 */
export function safeJsonParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('JSON parsing failed:', error.message);
    return fallback;
  }
}

/**
 * Safe JSON stringification with error handling
 * @param {any} data - Data to stringify
 * @param {string} fallback - Fallback value if stringification fails
 * @returns {string} JSON string or fallback value
 */
export function safeJsonStringify(data, fallback = '[]') {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.warn('JSON stringification failed:', error.message);
    return fallback;
  }
}

/**
 * Safe localStorage operations with error handling
 */
export const storage = {
  /**
   * Get item from localStorage with JSON parsing
   * @param {string} key - Storage key
   * @param {any} fallback - Fallback value
   * @returns {any} Parsed value or fallback
   */
  getItem(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return fallback;
      return safeJsonParse(item, fallback);
    } catch (error) {
      console.warn(`Failed to get item from localStorage: ${key}`, error.message);
      return fallback;
    }
  },

  /**
   * Set item in localStorage with JSON stringification
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {boolean} Success status
   */
  setItem(key, value) {
    try {
      const jsonString = safeJsonStringify(value);
      localStorage.setItem(key, jsonString);
      return true;
    } catch (error) {
      console.warn(`Failed to set item in localStorage: ${key}`, error.message);
      return false;
    }
  },

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove item from localStorage: ${key}`, error.message);
      return false;
    }
  },

  /**
   * Get string item from localStorage (without JSON parsing)
   * @param {string} key - Storage key
   * @param {string} fallback - Fallback value
   * @returns {string} Value or fallback
   */
  getString(key, fallback = '') {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (error) {
      console.warn(`Failed to get string from localStorage: ${key}`, error.message);
      return fallback;
    }
  },

  /**
   * Set string item in localStorage (without JSON stringification)
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   * @returns {boolean} Success status
   */
  setString(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`Failed to set string in localStorage: ${key}`, error.message);
      return false;
    }
  }
};

/**
 * Donor-specific storage operations
 */
export const donorStorage = {
  /**
   * Get all donors from storage
   * @returns {Array} Array of donors
   */
  getDonors() {
    return storage.getItem(STORAGE_KEYS.ANIMAL_DONORS, []);
  },

  /**
   * Save donors to storage
   * @param {Array} donors - Array of donors to save
   * @returns {boolean} Success status
   */
  saveDonors(donors) {
    if (!Array.isArray(donors)) {
      console.warn('saveDonors: Expected array, got:', typeof donors);
      return false;
    }
    return storage.setItem(STORAGE_KEYS.ANIMAL_DONORS, donors);
  },

  /**
   * Get editing donor from storage
   * @returns {Object|null} Editing donor or null
   */
  getEditingDonor() {
    return storage.getItem(STORAGE_KEYS.EDITING_DONOR, null);
  },

  /**
   * Save editing donor to storage
   * @param {Object} donor - Donor to save for editing
   * @returns {boolean} Success status
   */
  saveEditingDonor(donor) {
    return storage.setItem(STORAGE_KEYS.EDITING_DONOR, donor);
  },

  /**
   * Remove editing donor from storage
   * @returns {boolean} Success status
   */
  removeEditingDonor() {
    return storage.removeItem(STORAGE_KEYS.EDITING_DONOR);
  },

  /**
   * Get last used location
   * @returns {string} Last location or empty string
   */
  getLastLocation() {
    return storage.getString(STORAGE_KEYS.LAST_LOCATION, '');
  },

  /**
   * Save last used location
   * @param {string} location - Location to save
   * @returns {boolean} Success status
   */
  saveLastLocation(location) {
    return storage.setString(STORAGE_KEYS.LAST_LOCATION, location);
  },

  /**
   * Get last used date
   * @returns {string} Last date or empty string
   */
  getLastDate() {
    return storage.getString(STORAGE_KEYS.LAST_DATE, '');
  },

  /**
   * Save last used date
   * @param {string} date - Date to save
   * @returns {boolean} Success status
   */
  saveLastDate(date) {
    return storage.setString(STORAGE_KEYS.LAST_DATE, date);
  },

  /**
   * Get active location
   * @returns {string} Active location
   */
  getActiveLocation() {
    return storage.getString(STORAGE_KEYS.ACTIVE_LOCATION, 'רחובות');
  },

  /**
   * Save active location
   * @param {string} location - Location to save
   * @returns {boolean} Success status
   */
  saveActiveLocation(location) {
    return storage.setString(STORAGE_KEYS.ACTIVE_LOCATION, location);
  },

  /**
   * Get removed highlights
   * @returns {Array} Array of removed highlight IDs
   */
  getRemovedHighlights() {
    return storage.getItem(STORAGE_KEYS.REMOVED_HIGHLIGHTS, []);
  },

  /**
   * Save removed highlights
   * @param {Array} highlights - Array of highlight IDs
   * @returns {boolean} Success status
   */
  saveRemovedHighlights(highlights) {
    if (!Array.isArray(highlights)) {
      console.warn('saveRemovedHighlights: Expected array, got:', typeof highlights);
      return false;
    }
    return storage.setItem(STORAGE_KEYS.REMOVED_HIGHLIGHTS, highlights);
  }
};