import React, { useState, useEffect } from "react";
import { storage } from "../utils/localStorage";
import { validators } from "../utils/validation";

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

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingDonor) {
      setFormData(editingDonor);
      setErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // טעינה של ערכי ברירת מחדל מהמקומי (רק אם לא בעריכה)
      const lastLocation = storage.getLastLocation();
      const lastDate = storage.getLastDate();
      setFormData((prev) => ({
        ...prev,
        location: lastLocation,
        date: lastDate,
        isPrivateOwner: false, // שלא יישאר מסומן בטעות
      }));
      setErrors({});
    }
  }, [editingDonor]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => {
      let newForm = {
        ...prev,
        [name]: value,
        ...(name === "animalType" ? { bloodType: "", fiv: "", felv: "" } : {}),
      };

      // אם שינית מיקום – שמור ב־localStorage
      if (name === "location") {
        storage.setLastLocation(value);
      }
      // אם שינית תאריך – שמור ב־localStorage
      if (name === "date") {
        storage.setLastDate(value);
      }
      return newForm;
    });

    // Clear specific field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate form
    const validation = validators.validateDonorForm(formData);
    
    if (!validation.isValid) {
      setErrors(validation.errors);
      setIsSubmitting(false);
      return;
    }

    if (onAddDonor) {
      onAddDonor(formData);
      // שמור גם אחרי שליחה (ליתר ביטחון)
      if (formData.location) storage.setLastLocation(formData.location);
      if (formData.date) storage.setLastDate(formData.date);
    }

    if (!editingDonor) {
      setFormData({
        date: "",
        location: storage.getLastLocation(),
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
      setErrors({});
    }
    setIsSubmitting(false);
  };

  const locations = ['רחובות', 'איגוד ערים דן', 'פתחיה', 'חולון', 'חיצוני'];
  const dogBloodTypes = ['DEA 1.1 Positive', 'DEA 1.1 Negative'];
  const catBloodTypes = ['A', 'AB', 'B'];

  // Helper function to render input with error
  const renderInputWithError = (name, inputElement) => (
    <div>
      {inputElement}
      {errors[name] && (
        <div className="text-red-500 text-sm mt-1">{errors[name]}</div>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow border border-gray-300">
      <h2 className="text-2xl font-bold text-center mb-6">Donor Form</h2>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* כל הטופס הרגיל כאן */}

        {/* Date & Location */}
        <div className="grid grid-cols-2 gap-4">
          {renderInputWithError('date', 
            <div className="relative">
              <input
                id="date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className={`p-2 h-12 border rounded w-full text-sm focus:outline-none focus:ring-2 transition peer ${
                  errors.date ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {!formData.date && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">
                  Date
                </span>
              )}
            </div>
          )}
          {renderInputWithError('location',
            <select
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              className={`p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 transition ${
                errors.location ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            >
              <option value="">Select Location</option>
              {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          )}
        </div>

        {/* Animal Name & Weight */}
        <div className="grid grid-cols-2 gap-4">
          {renderInputWithError('animalName',
            <input 
              name="animalName" 
              placeholder="Animal Name" 
              value={formData.animalName} 
              onChange={handleChange} 
              required 
              className={`p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 transition ${
                errors.animalName ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
          )}
          {renderInputWithError('weight',
            <input 
              name="weight" 
              placeholder="Weight" 
              value={formData.weight} 
              onChange={handleChange} 
              type="number" 
              step="any" 
              className={`p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 transition ${
                errors.weight ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
          )}
        </div>

        {/* Age & Gender */}
        <div className="grid grid-cols-2 gap-4">
          {renderInputWithError('age',
            <input 
              name="age" 
              placeholder="Age" 
              value={formData.age} 
              onChange={handleChange} 
              type="number" 
              step="any" 
              className={`p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 transition ${
                errors.age ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
          )}
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
              {(formData.animalType === "Dog" ? dogBloodTypes : formData.animalType === "Cat" ? catBloodTypes : []).map(type => (
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
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`text-white py-3 rounded w-full transition ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isSubmitting ? 'שומר...' : 'Save'}
            </button>
            <button 
              type="button" 
              onClick={onCancelEdit} 
              disabled={isSubmitting}
              className="bg-gray-400 text-black py-3 rounded w-full hover:bg-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`md:col-span-2 w-full text-white py-3 rounded mt-2 transition ${
              isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'
            }`}
          >
            {isSubmitting ? 'שולח...' : 'Submit'}
          </button>
        )}
      </form>
    </div>
  );
};

export default DonorForm;
