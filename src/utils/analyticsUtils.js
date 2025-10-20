/**
 * Enhanced Analytics Utilities
 * Advanced data analysis and insights for donor management
 */

/**
 * Calculate donation trends over time
 * @param {Array} donors - Array of donor objects
 * @param {number} months - Number of months to analyze
 * @returns {Array} Monthly trend data
 */
export const getDonationTrends = (donors, months = 6) => {
  const now = new Date();
  const trends = [];

  for (let i = months - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
    
    const monthDonors = donors.filter(d => {
      if (!d.date) return false;
      const donorMonth = d.date.slice(0, 7);
      return donorMonth === monthKey;
    });

    const donated = monthDonors.filter(d => d.donated === 'Yes').length;
    const notDonated = monthDonors.filter(d => d.donated === 'No').length;

    trends.push({
      month: targetDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      monthKey,
      total: monthDonors.length,
      donated,
      notDonated,
      successRate: monthDonors.length > 0 ? Math.round((donated / monthDonors.length) * 100) : 0,
    });
  }

  return trends;
};

/**
 * Get donor statistics by location
 * @param {Array} donors - Array of donor objects
 * @returns {Object} Location-based statistics
 */
export const getLocationStats = (donors) => {
  const stats = {};

  donors.forEach(donor => {
    const loc = donor.location || 'Unknown';
    if (!stats[loc]) {
      stats[loc] = {
        total: 0,
        donated: 0,
        notDonated: 0,
        dogs: 0,
        cats: 0,
        privateOwners: 0,
        eligible: 0,
      };
    }

    stats[loc].total++;
    if (donor.donated === 'Yes') stats[loc].donated++;
    else stats[loc].notDonated++;

    if (donor.animalType?.toLowerCase() === 'dog') stats[loc].dogs++;
    if (donor.animalType?.toLowerCase() === 'cat') stats[loc].cats++;
    if (donor.isPrivateOwner) stats[loc].privateOwners++;

    // Check if eligible (90+ days since last donation)
    if (donor.date) {
      const lastDate = new Date(donor.date);
      const today = new Date();
      const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      if (daysSince >= 90) stats[loc].eligible++;
    }
  });

  return stats;
};

/**
 * Predict blood inventory needs
 * @param {Array} donors - Array of donor objects
 * @param {Object} currentInventory - Current inventory levels
 * @returns {Object} Predictions and recommendations
 */
export const predictInventoryNeeds = (donors, currentInventory = {}) => {
  const last30Days = donors.filter(d => {
    if (!d.date || d.donated !== 'Yes') return false;
    const donorDate = new Date(d.date);
    const now = new Date();
    const daysSince = Math.floor((now - donorDate) / (1000 * 60 * 60 * 24));
    return daysSince <= 30;
  });

  const avgPerMonth = last30Days.length;
  const predictions = {
    avgDonationsPerMonth: avgPerMonth,
    estimatedNextMonth: Math.ceil(avgPerMonth * 1.1), // 10% buffer
    recommendations: [],
  };

  // Analyze by blood type
  const bloodTypeCounts = {};
  last30Days.forEach(d => {
    const type = d.bloodType || 'Unknown';
    bloodTypeCounts[type] = (bloodTypeCounts[type] || 0) + 1;
  });

  predictions.byBloodType = bloodTypeCounts;

  // Generate recommendations
  Object.entries(currentInventory).forEach(([product, data]) => {
    const currentStock = data.stock || 0;
    const avgUsage = avgPerMonth / Object.keys(currentInventory).length; // Simple average

    if (currentStock < avgUsage) {
      predictions.recommendations.push({
        product,
        severity: 'high',
        message: `Low stock: ${currentStock} units (avg usage: ${Math.ceil(avgUsage)}/month)`,
      });
    } else if (currentStock < avgUsage * 2) {
      predictions.recommendations.push({
        product,
        severity: 'medium',
        message: `Stock OK: ${currentStock} units (avg usage: ${Math.ceil(avgUsage)}/month)`,
      });
    }
  });

  return predictions;
};

/**
 * Calculate donor retention rate
 * @param {Array} donors - Array of donor objects
 * @returns {Object} Retention statistics
 */
export const getDonorRetention = (donors) => {
  const donorsByAnimal = {};

  donors.forEach(d => {
    const key = `${d.animalName}-${d.location}`.toLowerCase();
    if (!donorsByAnimal[key]) {
      donorsByAnimal[key] = [];
    }
    donorsByAnimal[key].push(d);
  });

  let repeatDonors = 0;
  let onTimeRepeatDonors = 0; // Donated multiple times
  const totalAnimals = Object.keys(donorsByAnimal).length;

  Object.values(donorsByAnimal).forEach(records => {
    const donations = records.filter(r => r.donated === 'Yes');
    if (donations.length > 1) {
      repeatDonors++;
      
      // Check if donations are at least 90 days apart
      donations.sort((a, b) => new Date(a.date) - new Date(b.date));
      for (let i = 1; i < donations.length; i++) {
        const prev = new Date(donations[i - 1].date);
        const curr = new Date(donations[i].date);
        const daysBetween = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
        if (daysBetween >= 90) {
          onTimeRepeatDonors++;
          break; // Count animal only once
        }
      }
    }
  });

  return {
    totalAnimals,
    repeatDonors,
    onTimeRepeatDonors,
    retentionRate: totalAnimals > 0 ? Math.round((repeatDonors / totalAnimals) * 100) : 0,
    onTimeRetentionRate: totalAnimals > 0 ? Math.round((onTimeRepeatDonors / totalAnimals) * 100) : 0,
  };
};

/**
 * Get upcoming donors (eligible for donation)
 * @param {Array} donors - Array of donor objects
 * @param {number} daysAhead - Days to look ahead
 * @returns {Array} Upcoming eligible donors
 */
export const getUpcomingDonors = (donors, daysAhead = 30) => {
  const now = new Date();
  const upcoming = [];

  donors.forEach(donor => {
    if (!donor.date) return;

    const lastDate = new Date(donor.date);
    const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
    const daysUntilEligible = 90 - daysSince;

    // If becoming eligible within the next X days
    if (daysUntilEligible > 0 && daysUntilEligible <= daysAhead) {
      upcoming.push({
        ...donor,
        daysUntilEligible,
        eligibleDate: new Date(now.getTime() + daysUntilEligible * 24 * 60 * 60 * 1000),
      });
    }
  });

  return upcoming.sort((a, b) => a.daysUntilEligible - b.daysUntilEligible);
};

/**
 * Calculate blood type distribution trends
 * @param {Array} donors - Array of donor objects
 * @returns {Object} Blood type trends
 */
export const getBloodTypeTrends = (donors) => {
  const dogTypes = {};
  const catTypes = {};

  donors.forEach(d => {
    if (!d.bloodType) return;

    if (d.animalType?.toLowerCase() === 'dog') {
      dogTypes[d.bloodType] = (dogTypes[d.bloodType] || 0) + 1;
    } else if (d.animalType?.toLowerCase() === 'cat') {
      catTypes[d.bloodType] = (catTypes[d.bloodType] || 0) + 1;
    }
  });

  return {
    dogs: dogTypes,
    cats: catTypes,
    totalDogs: Object.values(dogTypes).reduce((sum, count) => sum + count, 0),
    totalCats: Object.values(catTypes).reduce((sum, count) => sum + count, 0),
  };
};

/**
 * Generate comprehensive analytics report
 * @param {Array} donors - Array of donor objects
 * @param {Object} inventory - Current inventory data
 * @returns {Object} Complete analytics report
 */
export const generateAnalyticsReport = (donors, inventory = {}) => {
  return {
    overview: {
      totalDonors: donors.length,
      totalDonations: donors.filter(d => d.donated === 'Yes').length,
      successRate: donors.length > 0 ? Math.round((donors.filter(d => d.donated === 'Yes').length / donors.length) * 100) : 0,
      privateOwners: donors.filter(d => d.isPrivateOwner).length,
      eligible: donors.filter(d => {
        if (!d.date) return false;
        const daysSince = Math.floor((new Date() - new Date(d.date)) / (1000 * 60 * 60 * 24));
        return daysSince >= 90;
      }).length,
    },
    trends: getDonationTrends(donors, 6),
    locationStats: getLocationStats(donors),
    retention: getDonorRetention(donors),
    upcoming: getUpcomingDonors(donors, 30),
    bloodTypes: getBloodTypeTrends(donors),
    predictions: predictInventoryNeeds(donors, inventory),
    generatedAt: new Date().toISOString(),
  };
};

export default {
  getDonationTrends,
  getLocationStats,
  predictInventoryNeeds,
  getDonorRetention,
  getUpcomingDonors,
  getBloodTypeTrends,
  generateAnalyticsReport,
};
