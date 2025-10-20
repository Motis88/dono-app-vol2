import Fuse from 'fuse.js';

/**
 * Advanced Search Utilities using Fuse.js
 * Provides fuzzy search capabilities across donor data
 */

// Fuse.js configuration for donor search
const donorSearchConfig = {
  // Fuzzy matching settings
  threshold: 0.3, // 0 = exact match, 1 = match anything
  distance: 100, // Maximum distance for match
  minMatchCharLength: 2, // Minimum characters to start matching
  
  // Performance
  shouldSort: true, // Sort by relevance score
  findAllMatches: false,
  
  // Fields to search in (with weights)
  keys: [
    { name: 'animalName', weight: 2.0 }, // Most important
    { name: 'fileNumber', weight: 1.5 },
    { name: 'ownerName', weight: 1.3 },
    { name: 'location', weight: 1.0 },
    { name: 'animalType', weight: 0.8 },
    { name: 'bloodType', weight: 0.7 },
    { name: 'ownerPhone', weight: 0.6 },
    { name: 'notes', weight: 0.5 },
    { name: 'gender', weight: 0.3 },
  ],
  
  // Advanced options
  includeScore: true, // Include match score in results
  includeMatches: true, // Include which fields matched
  useExtendedSearch: true, // Enable advanced query syntax
};

/**
 * Create a Fuse instance for donor search
 * @param {Array} donors - Array of donor objects
 * @returns {Fuse} Configured Fuse instance
 */
export const createDonorSearch = (donors) => {
  return new Fuse(donors, donorSearchConfig);
};

/**
 * Search donors with fuzzy matching
 * @param {Array} donors - Array of donor objects
 * @param {string} query - Search query
 * @returns {Array} Sorted array of matching donors
 */
export const searchDonors = (donors, query) => {
  if (!query || query.trim().length < 2) {
    return donors; // Return all if query too short
  }

  const fuse = createDonorSearch(donors);
  const results = fuse.search(query);
  
  // Return just the donor objects (without Fuse metadata)
  return results.map(result => result.item);
};

/**
 * Advanced search with filters
 * @param {Array} donors - Array of donor objects
 * @param {Object} options - Search options
 * @returns {Array} Filtered donors
 */
export const advancedSearch = (donors, options = {}) => {
  const {
    query = '',
    location = null,
    animalType = null,
    bloodType = null,
    donationStatus = null,
    dateFrom = null,
    dateTo = null,
    isPrivateOwner = null,
  } = options;

  let results = donors;

  // Apply fuzzy search first if query exists
  if (query && query.trim().length >= 2) {
    results = searchDonors(results, query);
  }

  // Apply exact filters
  if (location) {
    results = results.filter(d => d.location === location);
  }

  if (animalType) {
    results = results.filter(d => 
      d.animalType?.toLowerCase() === animalType.toLowerCase()
    );
  }

  if (bloodType) {
    results = results.filter(d => d.bloodType === bloodType);
  }

  if (donationStatus) {
    results = results.filter(d => d.donated === donationStatus);
  }

  if (dateFrom) {
    results = results.filter(d => {
      if (!d.date) return false;
      return new Date(d.date) >= new Date(dateFrom);
    });
  }

  if (dateTo) {
    results = results.filter(d => {
      if (!d.date) return false;
      return new Date(d.date) <= new Date(dateTo);
    });
  }

  if (isPrivateOwner !== null) {
    results = results.filter(d => d.isPrivateOwner === isPrivateOwner);
  }

  return results;
};

/**
 * Search with highlighting
 * Returns search results with matched text highlighted
 * @param {Array} donors - Array of donor objects
 * @param {string} query - Search query
 * @returns {Array} Results with highlighting info
 */
export const searchWithHighlights = (donors, query) => {
  if (!query || query.trim().length < 2) {
    return donors.map(donor => ({ donor, matches: [] }));
  }

  const fuse = createDonorSearch(donors);
  const results = fuse.search(query);
  
  return results.map(result => ({
    donor: result.item,
    score: result.score,
    matches: result.matches || [],
  }));
};

/**
 * Get search suggestions based on partial input
 * @param {Array} donors - Array of donor objects
 * @param {string} partial - Partial input
 * @param {number} limit - Max suggestions
 * @returns {Array} Suggested search terms
 */
export const getSearchSuggestions = (donors, partial, limit = 5) => {
  if (!partial || partial.trim().length < 1) {
    return [];
  }

  const suggestions = new Set();
  const lowerPartial = partial.toLowerCase();

  donors.forEach(donor => {
    // Check animal names
    if (donor.animalName?.toLowerCase().includes(lowerPartial)) {
      suggestions.add(donor.animalName);
    }
    // Check owner names
    if (donor.ownerName?.toLowerCase().includes(lowerPartial)) {
      suggestions.add(donor.ownerName);
    }
    // Check file numbers
    if (donor.fileNumber?.toLowerCase().includes(lowerPartial)) {
      suggestions.add(donor.fileNumber);
    }
  });

  return Array.from(suggestions).slice(0, limit);
};

/**
 * Multi-field search (OR logic)
 * Searches specific fields only
 * @param {Array} donors - Array of donor objects
 * @param {Object} fieldQueries - Object with field: query pairs
 * @returns {Array} Matching donors
 */
export const multiFieldSearch = (donors, fieldQueries) => {
  const matches = new Set();

  Object.entries(fieldQueries).forEach(([field, query]) => {
    if (!query || query.trim().length < 2) return;

    const config = {
      ...donorSearchConfig,
      keys: [field],
    };

    const fuse = new Fuse(donors, config);
    const results = fuse.search(query);
    results.forEach(r => matches.add(r.item));
  });

  return Array.from(matches);
};

/**
 * Search analytics - get search statistics
 * @param {Array} searchResults - Results from search
 * @returns {Object} Statistics object
 */
export const getSearchStats = (searchResults) => {
  const stats = {
    total: searchResults.length,
    byLocation: {},
    byAnimalType: {},
    byBloodType: {},
    donated: 0,
    notDonated: 0,
    privateOwners: 0,
  };

  searchResults.forEach(donor => {
    // Count by location
    const loc = donor.location || 'Unknown';
    stats.byLocation[loc] = (stats.byLocation[loc] || 0) + 1;

    // Count by animal type
    const type = donor.animalType || 'Unknown';
    stats.byAnimalType[type] = (stats.byAnimalType[type] || 0) + 1;

    // Count by blood type
    const blood = donor.bloodType || 'Unknown';
    stats.byBloodType[blood] = (stats.byBloodType[blood] || 0) + 1;

    // Donation status
    if (donor.donated === 'Yes') stats.donated++;
    else stats.notDonated++;

    // Private owners
    if (donor.isPrivateOwner) stats.privateOwners++;
  });

  return stats;
};

export default {
  createDonorSearch,
  searchDonors,
  advancedSearch,
  searchWithHighlights,
  getSearchSuggestions,
  multiFieldSearch,
  getSearchStats,
};
