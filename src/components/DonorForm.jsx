import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from 'prop-types';
import { LOCATIONS, BLOOD_TYPES, DONATION_STATUSES } from '../utils/constants.js';
import { donorStorage } from '../utils/storage.js';
import { validateDonor, sanitizeDonor } from '../utils/donorUtils.js';

const DonorForm = ({ onAddDonor, editingDonor, onCancelEdit }) => {
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
  const saveTimeoutRef = useRef(null);

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
      setFormData(editingDonor);
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

    setFormData(prev => {
      let newForm = {
        ...prev,
        [name]: finalValue,
        // Reset blood type and test results when animal type changes
        ...(name === "animalType" ? { bloodType: "", fiv: "", felv: "" } : {}),
      };

    // Save location and date to localStorage for convenience
    if (name === "location") {
      donorStorage.saveLastLocation(finalValue);
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

    if (formData.isPrivateOwner) {
      sanitizedData.ownerName = formData.ownerName || "";
      sanitizedData.fileNumber = formData.fileNumber || "";
      sanitizedData.ownerPhone = formData.ownerPhone || "";
    } else {
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
    <div className="max-w-7xl mx-auto p-1 sm:p-2 lg:p-3 bg-white rounded-lg sm:rounded-2xl shadow-xl sm:shadow-2xl border border-gray-200 pb-20 sm:pb-24">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 text-gray-800 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Donor Form</h2>
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-5 bg-red-50 border border-red-200 rounded-lg sm:rounded-xl shadow-sm">
          <h3 className="font-bold text-red-800 mb-2 sm:mb-3 text-sm sm:text-base">Please fix the following errors:</h3>
          <ul className="list-disc list-inside text-red-700 space-y-1 text-sm sm:text-base">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Date & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="relative">
            <input
              id="date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full text-sm focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 peer bg-gray-50 hover:bg-white"
            />
            {!formData.date && (
              <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">
                Date
              </span>
            )}
          </div>
          <select
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white"
          >
            <option value="">Select Location</option>
            {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>
        {/* Animal Name & Weight */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <input name="animalName" placeholder="Animal Name" value={formData.animalName} onChange={handleChange} required className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500" />
          <input name="weight" placeholder="Weight" value={formData.weight} onChange={handleChange} type="number" step="any" className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500" />
        </div>
        {/* Age & Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <input name="age" placeholder="Age" value={formData.age} onChange={handleChange} type="number" step="any" className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500" />
          <div className="flex flex-col gap-2 sm:gap-3 justify-center">
            <div className="font-semibold text-gray-700 text-sm sm:text-base">Gender:</div>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="Male"
                  checked={formData.gender === "Male"}
                  onChange={handleChange}
                  className="mr-2 w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700 text-sm sm:text-base">Male</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="Female"
                  checked={formData.gender === "Female"}
                  onChange={handleChange}
                  className="mr-2 w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700 text-sm sm:text-base">Female</span>
              </label>
            </div>
          </div>
        </div>
        {/* Animal Type (Dog/Cat) — רדיו */}
        <div className="flex flex-col gap-2 sm:gap-3">
          <span className="font-semibold text-gray-700 text-sm sm:text-base">Animal Type:</span>
          <div className="flex flex-wrap gap-6 sm:gap-8 p-3 sm:p-4 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="animalType"
                value="Dog"
                checked={formData.animalType === "Dog"}
                onChange={handleChange}
                className="mr-2 sm:mr-3 w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700 text-sm sm:text-base">Dog</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="animalType"
                value="Cat"
                checked={formData.animalType === "Cat"}
                onChange={handleChange}
                className="mr-2 sm:mr-3 w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700 text-sm sm:text-base">Cat</span>
            </label>
          </div>
        </div>
        {/* Blood Type — רדיו לפי Animal Type */}
        {formData.animalType && (
          <div className="flex flex-col gap-2 sm:gap-3">
            <span className="font-semibold text-gray-700 text-sm sm:text-base">Blood Type:</span>
            <div className="flex flex-wrap gap-4 sm:gap-8 p-3 sm:p-4 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white">
              {(formData.animalType === "Dog" ? BLOOD_TYPES.DOG : formData.animalType === "Cat" ? BLOOD_TYPES.CAT : []).map(type => (
                <label key={type} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="bloodType"
                    value={type}
                    checked={formData.bloodType === type}
                    onChange={handleChange}
                    className="mr-2 sm:mr-3 w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-700 text-xs sm:text-base">{type}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {/* FIV & FeLV (רק לחתול) */}
        {formData.animalType === 'Cat' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="flex flex-col gap-2 sm:gap-3">
              <span className="font-semibold text-gray-700 text-sm sm:text-base">FIV Status:</span>
              <div className="flex flex-wrap gap-4 sm:gap-6 p-3 sm:p-4 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white">
                {['Negative', 'Positive'].map(status => (
                  <label key={status} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="fiv"
                      value={status}
                      checked={formData.fiv === status}
                      onChange={handleChange}
                      className="mr-2 sm:mr-3 w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700 text-sm sm:text-base">{status}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:gap-3">
              <span className="font-semibold text-gray-700 text-sm sm:text-base">FeLV Status:</span>
              <div className="flex flex-wrap gap-4 sm:gap-6 p-3 sm:p-4 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white">
                {['Negative', 'Positive'].map(status => (
                  <label key={status} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="felv"
                      value={status}
                      checked={formData.felv === status}
                      onChange={handleChange}
                      className="mr-2 sm:mr-3 w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700 text-sm sm:text-base">{status}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* PCV, HCT, WBC, PLT */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <input name="pcv" type="number" step="any" value={formData.pcv} onChange={handleChange} placeholder="PCV" className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500" />
          <input name="hct" type="number" step="any" value={formData.hct} onChange={handleChange} placeholder="HCT" className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500" />
          <input name="wbc" type="number" step="any" value={formData.wbc} onChange={handleChange} placeholder="WBC" className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500" />
          <input name="plt" type="number" step="any" value={formData.plt} onChange={handleChange} placeholder="PLT" className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500" />
        </div>
        <input name="packedCell" placeholder="Packed Cell" value={formData.packedCell} onChange={handleChange} type="number" className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500" />
        <input name="slideFindings" placeholder="Slide Findings" value={formData.slideFindings} onChange={handleChange} className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500" />
        {/* Donated? רדיו */}
        <div className="flex flex-col gap-2 sm:gap-3">
          <span className="font-semibold text-gray-700 text-sm sm:text-base">Donated?</span>
          <div className="flex flex-wrap gap-4 sm:gap-8 p-3 sm:p-4 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="donated"
                value="Yes"
                checked={formData.donated === "Yes"}
                onChange={handleChange}
                className="mr-2 sm:mr-3 w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700 text-sm sm:text-base">Yes</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="donated"
                value="No"
                checked={formData.donated === "No"}
                onChange={handleChange}
                className="mr-2 sm:mr-3 w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700 text-sm sm:text-base">No</span>
            </label>
          </div>
        </div>
        <input
          name="volume"
          placeholder="Volume"
          value={formData.volume}
          onChange={handleChange}
          type="number"
          inputMode="numeric"
          className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500"
        />
        <textarea name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} rows={3} className="p-3 sm:p-4 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white placeholder-gray-500 md:col-span-2 resize-none" />
        {/* === צ'קבוקס "בעלים פרטי" ממש לפני ה-Submit === */}
        <div className="flex items-center mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg sm:rounded-xl border-2 border-blue-200">
          <input
            type="checkbox"
            id="isPrivateOwner"
            name="isPrivateOwner"
            checked={formData.isPrivateOwner}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                isPrivateOwner: e.target.checked,
                // פותח את הרובריקות רק כאשר מסומן
                ownerName: e.target.checked ? prev.ownerName : "",
                fileNumber: e.target.checked ? prev.fileNumber : "",
                ownerPhone: e.target.checked ? prev.ownerPhone : ""
              }))
            }
            className="mr-2 sm:mr-3 w-4 sm:w-5 h-4 sm:h-5 text-blue-600"
          />
          <label htmlFor="isPrivateOwner" className="font-semibold text-gray-700 cursor-pointer text-sm sm:text-base">בעלים פרטי</label>
        </div>
        {formData.isPrivateOwner && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-3 sm:mt-4 mb-3 sm:mb-4 p-4 sm:p-6 bg-gray-50 rounded-lg sm:rounded-xl border-2 border-gray-200">
            <input
              placeholder="Owner Name"
              value={formData.ownerName || ""}
              onChange={e => setFormData(f => ({ ...f, ownerName: e.target.value }))}
              className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 placeholder-gray-500"
            />
            <input
              placeholder="File Number"
              value={formData.fileNumber || ""}
              onChange={e => setFormData(f => ({ ...f, fileNumber: e.target.value }))}
              className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 placeholder-gray-500"
            />
            <input
              placeholder="Phone Number"
              value={formData.ownerPhone || ""}
              onChange={e => setFormData(f => ({ ...f, ownerPhone: e.target.value }))}
              className="p-3 sm:p-4 h-12 sm:h-14 border-2 border-gray-300 rounded-lg sm:rounded-xl w-full focus:outline-none focus:ring-2 sm:focus:ring-3 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 placeholder-gray-500"
            />
          </div>
        )}
        {/* === סוף תוספת === */}
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
