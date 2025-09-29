import { donorStorage } from './storage.js';
import { normalizeBloodType } from './donorUtils.js';

/**
 * Update all existing donor records to normalize blood types
 * This should be run once to fix imported data
 */
export const normalizeExistingBloodTypes = () => {
  try {
    const allDonors = donorStorage.getDonors();
    let updatedCount = 0;
    
    const updatedDonors = allDonors.map(donor => {
      if (donor.bloodType && donor.animalType) {
        const originalBloodType = donor.bloodType;
        const normalizedBloodType = normalizeBloodType(donor.bloodType, donor.animalType);
        
        if (originalBloodType !== normalizedBloodType) {
          updatedCount++;
          console.log(`Updated blood type for ${donor.animalName}: "${originalBloodType}" → "${normalizedBloodType}"`);
        }
        
        return {
          ...donor,
          bloodType: normalizedBloodType
        };
      }
      return donor;
    });
    
    donorStorage.saveDonors(updatedDonors);
    
    console.log(`Blood type normalization complete. Updated ${updatedCount} records.`);
    return { success: true, updatedCount };
  } catch (error) {
    console.error('Error normalizing blood types:', error);
    return { success: false, error };
  }
};