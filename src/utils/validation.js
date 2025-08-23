// Validation utilities

export const validators = {
  // Check if name has meaningful letters (not just numbers)
  isMeaningfulName: (name) => {
    if (!name) return false;
    const hasLetters = /[A-Za-z\u0590-\u05FF]/.test(name);
    const onlyDigits = /^\d+$/.test(name.trim());
    return hasLetters && !onlyDigits;
  },

  // Validate phone number (Israeli format)
  isValidPhone: (phone) => {
    if (!phone) return false;
    const cleaned = phone.replace(/[^0-9]/g, '');
    return cleaned.length >= 9 && cleaned.length <= 10;
  },

  // Validate date format
  isValidDate: (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  },

  // Validate age (should be positive number)
  isValidAge: (age) => {
    if (!age) return true; // Age is optional
    const numAge = parseFloat(age);
    return !isNaN(numAge) && numAge > 0 && numAge < 50; // Reasonable age range for pets
  },

  // Validate weight (should be positive number)
  isValidWeight: (weight) => {
    if (!weight) return true; // Weight is optional
    const numWeight = parseFloat(weight);
    return !isNaN(numWeight) && numWeight > 0 && numWeight < 200; // Reasonable weight range
  },

  // Validate animal type
  isValidAnimalType: (type) => {
    if (!type) return false;
    const validTypes = ['dog', 'cat', 'rabbit', 'bird', 'other'];
    return validTypes.includes(type.toLowerCase());
  },

  // Validate blood type
  isValidBloodType: (bloodType, animalType) => {
    if (!bloodType) return true; // Blood type is optional
    
    const dogBloodTypes = ['DEA 1.1+', 'DEA 1.1-', 'DEA 1.2+', 'DEA 1.2-'];
    const catBloodTypes = ['A', 'B', 'AB'];
    
    if (animalType?.toLowerCase() === 'dog') {
      return dogBloodTypes.includes(bloodType);
    } else if (animalType?.toLowerCase() === 'cat') {
      return catBloodTypes.includes(bloodType);
    }
    
    return true; // For other animal types, any blood type is acceptable
  },

  // Validate PCV value
  isValidPCV: (pcv) => {
    if (!pcv) return true; // PCV is optional
    const numPCV = parseFloat(pcv);
    return !isNaN(numPCV) && numPCV >= 10 && numPCV <= 80; // Normal range for pets
  },

  // Validate required form fields
  validateDonorForm: (formData) => {
    const errors = {};

    if (!formData.animalName?.trim()) {
      errors.animalName = 'שם הבעל חי נדרש';
    } else if (!validators.isMeaningfulName(formData.animalName)) {
      errors.animalName = 'שם הבעל חי חייב להכיל אותיות';
    }

    if (!formData.location?.trim()) {
      errors.location = 'מיקום נדרש';
    }

    if (!formData.date) {
      errors.date = 'תאריך נדרש';
    } else if (!validators.isValidDate(formData.date)) {
      errors.date = 'תאריך לא תקין';
    }

    if (!formData.animalType?.trim()) {
      errors.animalType = 'סוג בעל חי נדרש';
    }

    if (formData.age && !validators.isValidAge(formData.age)) {
      errors.age = 'גיל לא תקין';
    }

    if (formData.weight && !validators.isValidWeight(formData.weight)) {
      errors.weight = 'משקל לא תקין';
    }

    if (formData.pcv && !validators.isValidPCV(formData.pcv)) {
      errors.pcv = 'ערך PCV לא תקין (10-80)';
    }

    if (formData.bloodType && !validators.isValidBloodType(formData.bloodType, formData.animalType)) {
      errors.bloodType = 'סוג דם לא תקין לסוג הבעל חי';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};

// Date utilities
export const dateUtils = {
  // Format date to Hebrew locale
  formatDate: (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('he-IL');
    } catch {
      return dateString;
    }
  },

  // Calculate days between dates
  daysBetween: (date1, date2 = new Date()) => {
    if (!date1) return 0;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  },

  // Add days to date
  addDays: (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().slice(0, 10);
  },

  // Get today's date in YYYY-MM-DD format
  getToday: () => {
    return new Date().toISOString().slice(0, 10);
  }
};