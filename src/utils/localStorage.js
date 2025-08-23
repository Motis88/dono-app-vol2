// Utility functions for localStorage operations

export const storage = {
  // Get data with error handling
  getItem: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
      return defaultValue;
    }
  },

  // Set data with error handling
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
      return false;
    }
  },

  // Remove item with error handling
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing from localStorage key "${key}":`, error);
      return false;
    }
  },

  // Get donors array
  getDonors: () => {
    return storage.getItem('animal_donors', []);
  },

  // Set donors array
  setDonors: (donors) => {
    return storage.setItem('animal_donors', donors);
  },

  // Get last location
  getLastLocation: () => {
    return localStorage.getItem('last_location') || '';
  },

  // Set last location
  setLastLocation: (location) => {
    localStorage.setItem('last_location', location);
  },

  // Get last date
  getLastDate: () => {
    return localStorage.getItem('last_date') || '';
  },

  // Set last date
  setLastDate: (date) => {
    localStorage.setItem('last_date', date);
  },

  // Get active location
  getActiveLocation: () => {
    return localStorage.getItem('active_location') || 'רחובות';
  },

  // Set active location
  setActiveLocation: (location) => {
    localStorage.setItem('active_location', location);
  },

  // Get removed highlights
  getRemovedHighlights: () => {
    return storage.getItem('removed_highlights', []);
  },

  // Set removed highlights
  setRemovedHighlights: (highlights) => {
    return storage.setItem('removed_highlights', highlights);
  }
};