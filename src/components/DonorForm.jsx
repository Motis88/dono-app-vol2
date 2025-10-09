import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from 'prop-types';
import { LOCATIONS, BLOOD_TYPES, DONATION_STATUSES } from '../utils/constants.js';
import { donorStorage } from '../utils/storage.js';
import { validateDonor, sanitizeDonor, normalizeBloodType } from '../utils/donorUtils.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

const DonorForm = ({ onAddDonor, onCancelEdit, editingDonor }) => {
  const { colors } = useTheme();
  
  // Input styles for consistent theming
  const inputStyles = `p-3 sm:p-4 h-12 sm:h-14 border-2 ${colors.border.input} rounded-lg sm:rounded-xl w-full text-sm focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 ${colors.border.focus} transition-all duration-200 ${colors.bg.input} ${colors.bg.inputHover} ${colors.text.primary} ${colors.text.placeholder}`;
  const selectStyles = `p-3 sm:p-4 h-12 sm:h-14 border-2 ${colors.border.input} rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 ${colors.border.focus} transition-all duration-200 ${colors.bg.input} ${colors.bg.inputHover} ${colors.text.primary}`;
  const [formData, setFormData] = useState({
    date: "",
    location: "",
    animalName: "",
    age: "",
    weight: "",
    gender: "",
    animalType: "",
    bloodType: "",
    fiv: "",
    felv: "",
    pcv: "",
    hct: "",
    wbc: "",
    plt: "",
    packedCell: "",
    slideFindings: "",
    donated: "",
    volume: "",
    notes: "",
    isPrivateOwner: false,
    ownerName: "",
    fileNumber: "",
    ownerPhone: "",
  });

  const [validationErrors, setValidationErrors] = useState([]);
  const [animalSuggestions, setAnimalSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const saveTimeoutRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for similar animals in history
  const searchSimilarAnimals = useCallback((animalName, location) => {
    if (!animalName || animalName.trim().length < 2 || /^\d+$/.test(animalName.trim())) {
      setAnimalSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const allDonors = donorStorage.getDonors();
    const namePattern = animalName.toLowerCase().trim();
    
    // Find animals with similar names from the same location
    const suggestions = allDonors
      .filter(donor => 
        donor.location === location &&
        donor.animalName &&
        donor.animalName.toLowerCase().includes(namePattern) &&
        donor.animalName.toLowerCase() !== namePattern && // Don't suggest exact matches
        (!editingDonor || donor.id !== editingDonor.id) // Don't suggest the donor being edited
      )
      .reduce((unique, donor) => {
        // Remove duplicates by animalName
        const exists = unique.find(d => d.animalName === donor.animalName);
        if (!exists) {
          unique.push(donor);
        }
        return unique;
      }, [])
      .slice(0, 5); // Limit to 5 suggestions

    setAnimalSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);
  }, [editingDonor]);

  // Handle animal name input change
  const handleAnimalNameChange = (value) => {
    setFormData(prev => ({ ...prev, animalName: value }));
    setSelectedSuggestion(null); // Clear selected suggestion when user types
    searchSimilarAnimals(value, formData.location);
  };

  // Apply suggestion to form
  const applySuggestion = (suggestion) => {
    setFormData(prev => ({
      ...prev,
      id: suggestion.id, // Keep the same ID for continued tracking
      animalName: suggestion.animalName,
      age: suggestion.age || prev.age,
      weight: suggestion.weight || prev.weight,
      gender: suggestion.gender || prev.gender,
      animalType: suggestion.animalType || prev.animalType,
      bloodType: suggestion.bloodType || prev.bloodType,
      isPrivateOwner: suggestion.isPrivateOwner || prev.isPrivateOwner,
      ownerName: suggestion.ownerName || prev.ownerName,
      fileNumber: suggestion.fileNumber || prev.fileNumber,
      ownerPhone: suggestion.ownerPhone || prev.ownerPhone,
      // Keep current date and location
      date: prev.date,
      location: prev.location,
      // Reset donation-specific fields for new entry
      donated: "",
      volume: "",
      notes: "",
      pcv: "",
      hct: "",
      wbc: "",
      plt: "",
      packedCell: "",
      slideFindings: "",
      fiv: prev.animalType === suggestion.animalType ? suggestion.fiv || "" : "",
      felv: prev.animalType === suggestion.animalType ? suggestion.felv || "" : "",
    }));
    setShowSuggestions(false);
    setSelectedSuggestion(suggestion);
  };

  // Clear suggestion and create new donor
  const clearSuggestion = () => {
    setSelectedSuggestion(null);
    setFormData(prev => ({
      ...prev,
      id: undefined, // Remove ID to create new donor
    }));
  };

  // Debounced save function to avoid saving on every keystroke
  const debouncedSave = useCallback((data) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (!editingDonor) {
        // Only save if form has meaningful data (not completely empty)
        const hasData = Object.values(data).some(value => 
          value !== "" && value !== false && value !== null
        );
        if (hasData) {
          donorStorage.saveDraftForm(data);
        }
      }
    }, 500); // Save after 500ms of no changes
  }, [editingDonor]);

  // Save form data to localStorage with debouncing
  useEffect(() => {
    debouncedSave(formData);
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, debouncedSave]);

  useEffect(() => {
    if (editingDonor) {
      // Normalize blood type when editing imported donors
      const normalizedDonor = {
        ...editingDonor,
        bloodType: normalizeBloodType(editingDonor.bloodType, editingDonor.animalType)
      };
      setFormData(normalizedDonor);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Load draft form data from localStorage (only if not editing)
      const draftFormData = donorStorage.getDraftForm();
      if (draftFormData) {
        setFormData(draftFormData);
      } else {
        // Fallback to just location and date if no draft exists
        const lastLocation = donorStorage.getLastLocation();
        const lastDate = donorStorage.getLastDate();
        setFormData((prev) => ({
          ...prev,
          location: lastLocation,
          date: lastDate,
          isPrivateOwner: false,
        }));
      }
    }
  }, [editingDonor]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;

    // Special handling for animal name - trigger suggestions
    if (name === 'animalName') {
      handleAnimalNameChange(finalValue);
      return;
    }

    setFormData(prev => {
      let newForm = {
        ...prev,
        [name]: finalValue,
        // Reset blood type and test results when animal type changes
        ...(name === "animalType" ? { bloodType: "", fiv: "", felv: "" } : {}),
        // Clear suggestions and selected suggestion when location changes
        ...(name === "location" ? {} : {}),
      };

      // Save location and date to localStorage for convenience
      if (name === "location") {
        donorStorage.saveLastLocation(finalValue);
        // Clear suggestions when location changes
        setShowSuggestions(false);
        setAnimalSuggestions([]);
        setSelectedSuggestion(null);
      }
      if (name === "date" && typeof finalValue === 'string') {
        donorStorage.saveLastDate(finalValue);
      }
      return newForm;
    });

    // Clear validation errors when user starts fixing them
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form data
    const validation = validateDonor(formData);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Sanitize donor data before submitting
    const sanitizedData = sanitizeDonor(formData);
    
    // Ensure blood type is preserved from formData
    if (formData.bloodType) {
      sanitizedData.bloodType = formData.bloodType;
    }

    // Auto-mark as private owner if owner name exists
    const hasOwnerInfo = formData.ownerName?.trim() || formData.ownerPhone?.trim() || formData.fileNumber?.trim();
    if (formData.isPrivateOwner || hasOwnerInfo) {
      sanitizedData.isPrivateOwner = true;
      sanitizedData.ownerName = formData.ownerName || "";
      sanitizedData.fileNumber = formData.fileNumber || "";
      sanitizedData.ownerPhone = formData.ownerPhone || "";
    } else {
      sanitizedData.isPrivateOwner = false;
      sanitizedData.ownerName = "";
      sanitizedData.fileNumber = "";
      sanitizedData.ownerPhone = "";
    }
    
    if (onAddDonor) {
      onAddDonor(sanitizedData);
    }
    
    // Save location and date for next time
    if (sanitizedData.location) {
      donorStorage.saveLastLocation(sanitizedData.location);
    }
    if (sanitizedData.date) {
      donorStorage.saveLastDate(sanitizedData.date);
    }
    
    // Clear validation errors after successful submission
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }

    if (!editingDonor) {
      // Reset form and clear draft
      resetForm();
      donorStorage.clearDraftForm(); // Clear the saved draft after successful submission
    }
  };

  const resetForm = () => {
    setFormData({
      date: "",
      location: "",
      animalName: "",
      age: "",
      weight: "",
      gender: "",
      animalType: "",
      bloodType: "",
      fiv: "",
      felv: "",
      pcv: "",
      hct: "",
      wbc: "",
      plt: "",
      packedCell: "",
      slideFindings: "",
      donated: "",
      volume: "",
      notes: "",
      isPrivateOwner: false,
      ownerName: "",
      fileNumber: "",
      ownerPhone: "",
    });
    setValidationErrors([]);
    donorStorage.clearDraftForm(); // Also clear draft when manually resetting
  };

  return (
    <div className={`max-w-7xl mx-auto p-1 sm:p-2 lg:p-3 ${colors.bg.form} rounded-lg sm:rounded-2xl shadow-xl sm:shadow-2xl ${colors.border.primary} border pb-20 sm:pb-24`}>
      <h2 className={`text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 ${colors.text.primary} bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent`}>Donor Form</h2>
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className={`mb-4 sm:mb-6 p-3 sm:p-5 ${colors.bg.tertiary} ${colors.border.secondary} border rounded-lg sm:rounded-xl shadow-sm`}>
          <h3 className={`font-bold ${colors.text.error} mb-2 sm:mb-3 text-sm sm:text-base`}>Please fix the following errors:</h3>
          <ul className={`list-disc list-inside ${colors.text.error} space-y-1 text-sm sm:text-base`}>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Main Info - Two Rows Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="relative">
            <input
              id="date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              className={`${inputStyles} peer`}
            />
            {!formData.date && (
              <span className={`absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 ${colors.text.muted} text-sm pointer-events-none select-none`}>
                Date
              </span>
            )}
          </div>
          <select
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            className={selectStyles}
          >
            <option value="">Select Location</option>
            {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          <div className="relative" ref={suggestionsRef}>
            <input 
              name="animalName" 
              placeholder="Animal Name" 
              value={formData.animalName} 
              onChange={handleChange} 
              required 
              className={inputStyles}
              autoComplete="off"
            />
            {/* Animal Suggestions Dropdown */}
            {showSuggestions && animalSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-700">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">🔍 Similar donors at this location:</span>
                </div>
                {animalSuggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.id || index}
                    onClick={() => applySuggestion(suggestion)}
                    className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-blue-800 dark:text-blue-200">{suggestion.animalName}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {suggestion.animalType && <span className="mr-2">🐾 {suggestion.animalType}</span>}
                          {suggestion.bloodType && <span className="mr-2">🩸 {suggestion.bloodType}</span>}
                          {suggestion.age && <span className="mr-2">📅 {suggestion.age}</span>}
                          {suggestion.weight && <span>⚖️ {suggestion.weight}kg</span>}
                        </div>
                        {suggestion.isPrivateOwner && suggestion.ownerName && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            👤 {suggestion.ownerName}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 ml-2">Click to copy</div>
                    </div>
                  </div>
                ))}
                <div className="p-2 bg-gray-50 dark:bg-gray-800 text-center">
                  <button
                    type="button"
                    onClick={() => setShowSuggestions(false)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕ Close suggestions
                  </button>
                </div>
              </div>
            )}
            {/* Selected suggestion indicator */}
            {selectedSuggestion && (
              <div className="absolute -bottom-8 left-0 right-0 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-600 rounded-lg p-2 mt-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-600 dark:text-green-400 font-semibold">✓ Using existing donor data:</span>
                  <span className="text-green-700 dark:text-green-300 font-bold">{selectedSuggestion.animalName}</span>
                  <button
                    type="button"
                    onClick={clearSuggestion}
                    className="ml-auto text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                    title="Clear selection and start new donor"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
          <input name="weight" placeholder="Weight (kg)" value={formData.weight} onChange={handleChange} type="number" step="any" className={inputStyles} />
          
          {/* Second Row: Age, Gender, Animal Type, Blood Type */}
          <input name="age" placeholder="Age" value={formData.age} onChange={handleChange} type="number" step="any" className={inputStyles} />
          <select name="gender" value={formData.gender} onChange={handleChange} className={selectStyles}>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <select name="animalType" value={formData.animalType} onChange={handleChange} className={selectStyles}>
            <option value="">Animal Type</option>
            <option value="Dog">Dog</option>
            <option value="Cat">Cat</option>
          </select>
          <select name="bloodType" value={formData.bloodType} onChange={handleChange} className={selectStyles}>
            <option value="">Blood Type</option>
            {formData.animalType && (formData.animalType === "Dog" ? BLOOD_TYPES.DOG : formData.animalType === "Cat" ? BLOOD_TYPES.CAT : []).map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        {/* FIV & FeLV (cats only) */}
        {formData.animalType === 'Cat' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <select name="fiv" value={formData.fiv} onChange={handleChange} className={selectStyles}>
              <option value="">FIV Status</option>
              <option value="Negative">FIV Negative</option>
              <option value="Positive">FIV Positive</option>
            </select>
            <select name="felv" value={formData.felv} onChange={handleChange} className={selectStyles}>
              <option value="">FeLV Status</option>
              <option value="Negative">FeLV Negative</option>
              <option value="Positive">FeLV Positive</option>
            </select>
          </div>
        )}
        {/* Blood Work - Compact Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
          <input name="pcv" type="number" step="any" value={formData.pcv} onChange={handleChange} placeholder="PCV" className={inputStyles} />
          <input name="hct" type="number" step="any" value={formData.hct} onChange={handleChange} placeholder="HCT" className={inputStyles} />
          <input name="wbc" type="number" step="any" value={formData.wbc} onChange={handleChange} placeholder="WBC" className={inputStyles} />
          <input name="plt" type="number" step="any" value={formData.plt} onChange={handleChange} placeholder="PLT" className={inputStyles} />
          <input name="packedCell" placeholder="Packed Cell" value={formData.packedCell} onChange={handleChange} type="number" className={inputStyles} />
          <input name="slideFindings" placeholder="Slide Findings" value={formData.slideFindings} onChange={handleChange} className={inputStyles} />
        </div>
        {/* Donation Info - Compact Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="flex flex-col gap-3">
            <span className={`font-semibold ${colors.text.primary} text-sm sm:text-base`}>Donated?</span>
            <div className="flex gap-3 sm:gap-4">
              <label className="flex items-center cursor-pointer text-sm sm:text-base">
                <input
                  type="radio"
                  name="donated"
                  value="Yes"
                  checked={formData.donated === "Yes"}
                  onChange={handleChange}
                  className="mr-2 w-4 h-4 text-blue-600"
                />
                <span className={`${colors.text.primary} font-medium`}>Yes</span>
              </label>
              <label className="flex items-center cursor-pointer text-sm sm:text-base">
                <input
                  type="radio"
                  name="donated"
                  value="No"
                  checked={formData.donated === "No"}
                  onChange={handleChange}
                  className="mr-2 w-4 h-4 text-blue-600"
                />
                <span className={`${colors.text.primary} font-medium`}>No</span>
              </label>
            </div>
          </div>
          <input
            name="volume"
            placeholder="Volume (ml)"
            value={formData.volume}
            onChange={handleChange}
            type="number"
            inputMode="numeric"
            className={inputStyles}
          />
          <textarea 
            name="notes" 
            placeholder="Notes" 
            value={formData.notes} 
            onChange={handleChange} 
            rows={3}
            className={`${inputStyles} h-auto min-h-[80px] resize-none`}
          />
        </div>
        {/* Private Owner checkbox before Submit */}
        <div className={`flex items-center mt-4 sm:mt-6 p-3 sm:p-4 ${colors.bg.tertiary} rounded-lg sm:rounded-xl border-2 ${colors.border.primary}`}>
          <input
            type="checkbox"
            id="isPrivateOwner"
            name="isPrivateOwner"
            checked={formData.isPrivateOwner}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                isPrivateOwner: e.target.checked,
                // Opens the fields only when checked
                ownerName: e.target.checked ? prev.ownerName : "",
                fileNumber: e.target.checked ? prev.fileNumber : "",
                ownerPhone: e.target.checked ? prev.ownerPhone : ""
              }))
            }
            className="mr-2 sm:mr-3 w-4 sm:w-5 h-4 sm:h-5 text-blue-600"
          />
          <label htmlFor="isPrivateOwner" className={`font-semibold ${colors.text.primary} cursor-pointer text-sm sm:text-base`}>Private Owner</label>
        </div>
        {formData.isPrivateOwner && (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-3 sm:mt-4 mb-3 sm:mb-4 p-4 sm:p-6 ${colors.bg.tertiary} rounded-lg sm:rounded-xl border-2 ${colors.border.primary}`}>
            <input
              placeholder="Owner Name"
              value={formData.ownerName || ""}
              onChange={e => setFormData(f => ({ ...f, ownerName: e.target.value }))}
              className={inputStyles}
            />
            <input
              placeholder="File Number"
              value={formData.fileNumber || ""}
              onChange={e => setFormData(f => ({ ...f, fileNumber: e.target.value }))}
              className={inputStyles}
            />
            <input
              placeholder="Owner Phone Number"
              value={formData.ownerPhone || ""}
              onChange={e => {
                const value = e.target.value;
                // Allow only digits, spaces, hyphens, and plus sign
                const sanitized = value.replace(/[^0-9\s\-+]/g, '');
                setFormData(f => ({ ...f, ownerPhone: sanitized }));
              }}
              className={inputStyles}
              type="tel"
              inputMode="tel"
            />
          </div>
        )}
        {/* End of private owner section */}
        {editingDonor ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:col-span-2 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t-2 border-gray-200">
            <button 
              type="submit" 
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-lg sm:rounded-xl w-full font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
            >
              Save
            </button>
            <button 
              type="button" 
              onClick={onCancelEdit} 
              className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-lg sm:rounded-xl w-full font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:col-span-2 mt-6 sm:mt-8">
            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-lg sm:rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
            >
              Submit
            </button>
            <button 
              type="button" 
              onClick={resetForm}
              className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-lg sm:rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
            >
              Clear Form
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

DonorForm.propTypes = {
  onAddDonor: PropTypes.func,
  editingDonor: PropTypes.object,
  onCancelEdit: PropTypes.func,
};

export default DonorForm;
