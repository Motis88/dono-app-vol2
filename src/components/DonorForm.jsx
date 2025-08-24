import React, { useState, useEffect } from "react";
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
  });

  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    if (editingDonor) {
      setFormData(editingDonor);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Load default values from localStorage (only if not editing)
      const lastLocation = donorStorage.getLastLocation();
      const lastDate = donorStorage.getLastDate();
      setFormData((prev) => ({
        ...prev,
        location: lastLocation,
        date: lastDate,
        isPrivateOwner: false,
      }));
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
      if (name === "location" && typeof finalValue === 'string') {
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

    // Sanitize form data before submission
    const sanitizedData = sanitizeDonor(formData);
    
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
    
    // Reset form
    resetForm();
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
    });
    setValidationErrors([]);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow border border-gray-300">
      <h2 className="text-2xl font-bold text-center mb-6">Donor Form</h2>
      
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 rounded">
          <h3 className="font-bold text-red-800 mb-2">Please fix the following errors:</h3>
          <ul className="list-disc list-inside text-red-700">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Date & Location */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <input
              id="date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              className="p-2 h-12 border rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition peer"
            />
            {!formData.date && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">
                Date
              </span>
            )}
          </div>
          <select
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">Select Location</option>
            {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>

        {/* Animal Name & Weight */}
        <div className="grid grid-cols-2 gap-4">
          <input name="animalName" placeholder="Animal Name" value={formData.animalName} onChange={handleChange} required className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <input name="weight" placeholder="Weight" value={formData.weight} onChange={handleChange} type="number" step="any" className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>

        {/* Age & Gender */}
        <div className="grid grid-cols-2 gap-4">
          <input name="age" placeholder="Age" value={formData.age} onChange={handleChange} type="number" step="any" className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <div className="flex flex-col gap-2 justify-center">
            <div className="font-semibold">Gender:</div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="gender"
                  value="Male"
                  checked={formData.gender === "Male"}
                  onChange={handleChange}
                  className="mr-1"
                />
                Male
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="gender"
                  value="Female"
                  checked={formData.gender === "Female"}
                  onChange={handleChange}
                  className="mr-1"
                />
                Female
              </label>
            </div>
          </div>
        </div>

        {/* Animal Type (Dog/Cat) — רדיו */}
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Animal Type:</span>
          <div className="flex flex-wrap gap-6 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
            <label className="flex items-center">
              <input
                type="radio"
                name="animalType"
                value="Dog"
                checked={formData.animalType === "Dog"}
                onChange={handleChange}
                className="mr-1"
              />
              Dog
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="animalType"
                value="Cat"
                checked={formData.animalType === "Cat"}
                onChange={handleChange}
                className="mr-1"
              />
              Cat
            </label>
          </div>
        </div>

        {/* Blood Type — רדיו לפי Animal Type */}
        {formData.animalType && (
          <div className="flex flex-col gap-2">
            <span className="font-semibold">Blood Type:</span>
            <div className="flex flex-wrap gap-6 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
              {(formData.animalType === "Dog" ? BLOOD_TYPES.DOG : formData.animalType === "Cat" ? BLOOD_TYPES.CAT : []).map(type => (
                <label key={type} className="flex items-center">
                  <input
                    type="radio"
                    name="bloodType"
                    value={type}
                    checked={formData.bloodType === type}
                    onChange={handleChange}
                    className="mr-1"
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* FIV & FeLV (רק לחתול) */}
        {formData.animalType === 'Cat' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="font-semibold">FIV Status:</span>
              <div className="flex flex-wrap gap-4 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                {["Negative", "Positive"].map(status => (
                  <label key={status} className="flex items-center">
                    <input
                      type="radio"
                      name="fiv"
                      value={status}
                      checked={formData.fiv === status}
                      onChange={handleChange}
                      className="mr-1"
                    />
                    {status}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold">FeLV Status:</span>
              <div className="flex flex-wrap gap-4 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                {["Negative", "Positive"].map(status => (
                  <label key={status} className="flex items-center">
                    <input
                      type="radio"
                      name="felv"
                      value={status}
                      checked={formData.felv === status}
                      onChange={handleChange}
                      className="mr-1"
                    />
                    {status}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PCV, HCT, WBC, PLT */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <input name="pcv" type="number" step="any" value={formData.pcv} onChange={handleChange} placeholder="PCV" className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <input name="hct" type="number" step="any" value={formData.hct} onChange={handleChange} placeholder="HCT" className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <input name="wbc" type="number" step="any" value={formData.wbc} onChange={handleChange} placeholder="WBC" className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <input name="plt" type="number" step="any" value={formData.plt} onChange={handleChange} placeholder="PLT" className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>

        <input name="packedCell" placeholder="Packed Cell" value={formData.packedCell} onChange={handleChange} type="number" className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        <input name="slideFindings" placeholder="Slide Findings" value={formData.slideFindings} onChange={handleChange} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />

        {/* Donated? רדיו */}
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Donated?</span>
          <div className="flex flex-wrap gap-6 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
            <label className="flex items-center">
              <input
                type="radio"
                name="donated"
                value="Yes"
                checked={formData.donated === "Yes"}
                onChange={handleChange}
                className="mr-1"
              />
              Yes
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="donated"
                value="No"
                checked={formData.donated === "No"}
                onChange={handleChange}
                className="mr-1"
              />
              No
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
          className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />

        <textarea name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} rows={2} className="p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition md:col-span-2" />

        {/* === צ'קבוקס "בעלים פרטי" ממש לפני ה-Submit === */}
        <div className="flex items-center mt-4">
          <input
            type="checkbox"
            id="isPrivateOwner"
            name="isPrivateOwner"
            checked={formData.isPrivateOwner}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                isPrivateOwner: e.target.checked
              }))
            }
            className="mr-2"
          />
          <label htmlFor="isPrivateOwner">בעלים פרטי</label>
        </div>
        {/* === סוף תוספת === */}

        {editingDonor ? (
          <div className="grid grid-cols-2 gap-2 md:col-span-2 mt-2">
            <button type="submit" className="bg-green-600 text-white py-3 rounded w-full hover:bg-green-700">Save</button>
            <button type="button" onClick={onCancelEdit} className="bg-gray-400 text-black py-3 rounded w-full hover:bg-gray-500">Cancel</button>
          </div>
        ) : (
          <button type="submit" className="md:col-span-2 w-full bg-black text-white py-3 rounded hover:bg-gray-800 mt-2">Submit</button>
        )}
      </form>
    </div>
  );
};

export default DonorForm;
