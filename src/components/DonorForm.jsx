import React, { useEffect } from "react";
import { useDonorForm } from "../hooks/useDonorForm";

const DonorForm = ({ onAddDonor, editingDonor, onCancelEdit }) => {
  const { formData, bind, setForm, resetForm } = useDonorForm();

  useEffect(() => {
    if (editingDonor) {
      setForm(editingDonor);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      resetForm();
    }
  }, [editingDonor]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onAddDonor) onAddDonor(formData);
    if (formData.location) localStorage.setItem("last_location", formData.location);
    if (formData.date) localStorage.setItem("last_date", formData.date);
    resetForm();
  };

  const locations = ['רחובות', 'איגוד ערים דן', 'פתחיה', 'חולון', 'חיצוני'];
  const dogBloodTypes = ['DEA 1.1 Positive', 'DEA 1.1 Negative'];
  const catBloodTypes = ['A', 'AB', 'B'];

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow border border-gray-300">
      <h2 className="text-2xl font-bold text-center mb-6">Donor Form</h2>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Date & Location */}
        <div className="grid grid-cols-2 gap-4">
          <input type="date" required {...bind("date")} className="p-2 h-12 border rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <select required {...bind("location")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
            <option value="">Select Location</option>
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>

        {/* Animal Name & Weight */}
        <div className="grid grid-cols-2 gap-4">
          <input placeholder="Animal Name" required {...bind("animalName")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <input placeholder="Weight" type="number" step="any" {...bind("weight")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>

        {/* Age & Gender */}
        <div className="grid grid-cols-2 gap-4">
          <input placeholder="Age" type="number" step="any" {...bind("age")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <div className="flex flex-col gap-2 justify-center">
            <div className="font-semibold">Gender:</div>
            <div className="flex flex-wrap gap-4">
              {["Male", "Female"].map(g => (
                <label key={g} className="flex items-center">
                  <input type="radio" name="gender" value={g} checked={formData.gender === g} onChange={bind("gender").onChange} className="mr-1" />
                  {g}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Animal Type */}
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Animal Type:</span>
          <div className="flex flex-wrap gap-6 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
            {["Dog", "Cat"].map(type => (
              <label key={type} className="flex items-center">
                <input type="radio" name="animalType" value={type} checked={formData.animalType === type} onChange={bind("animalType").onChange} className="mr-1" />
                {type}
              </label>
            ))}
          </div>
        </div>

        {/* Blood Type */}
        {formData.animalType && (
          <div className="flex flex-col gap-2">
            <span className="font-semibold">Blood Type:</span>
            <div className="flex flex-wrap gap-6 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
              {(formData.animalType === "Dog" ? dogBloodTypes : catBloodTypes).map(type => (
                <label key={type} className="flex items-center">
                  <input type="radio" name="bloodType" value={type} checked={formData.bloodType === type} onChange={bind("bloodType").onChange} className="mr-1" />
                  {type}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* FIV & FeLV (only if Cat) */}
        {formData.animalType === 'Cat' && (
          <div className="grid grid-cols-2 gap-4">
            {["fiv", "felv"].map((field) => (
              <div key={field} className="flex flex-col gap-2">
                <span className="font-semibold">{field.toUpperCase()} Status:</span>
                <div className="flex flex-wrap gap-4 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                  {["Negative", "Positive"].map(status => (
                    <label key={status} className="flex items-center">
                      <input type="radio" name={field} value={status} checked={formData[field] === status} onChange={bind(field).onChange} className="mr-1" />
                      {status}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PCV, HCT, WBC, PLT */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <input placeholder="PCV" type="number" step="any" {...bind("pcv")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <input placeholder="HCT" type="number" step="any" {...bind("hct")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <input placeholder="WBC" type="number" step="any" {...bind("wbc")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <input placeholder="PLT" type="number" step="any" {...bind("plt")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>

        <input placeholder="Packed Cell" type="number" {...bind("packedCell")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        <input placeholder="Slide Findings" {...bind("slideFindings")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />

        {/* Donated? */}
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Donated?</span>
          <div className="flex flex-wrap gap-6 p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
            {["Yes", "No"].map(status => (
              <label key={status} className="flex items-center">
                <input type="radio" name="donated" value={status} checked={formData.donated === status} onChange={bind("donated").onChange} className="mr-1" />
                {status}
              </label>
            ))}
          </div>
        </div>

        <input placeholder="Volume" type="number" inputMode="numeric" {...bind("volume")} className="p-2 h-12 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        <textarea placeholder="Notes" rows={2} {...bind("notes")} className="p-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition md:col-span-2" />

        {/* CheckBox: בעלים פרטי */}
        <div className="flex items-center mt-4">
          <input type="checkbox" id="isPrivateOwner" {...bind("isPrivateOwner")} className="mr-2" />
          <label htmlFor="isPrivateOwner">בעלים פרטי</label>
        </div>

        {/* Buttons */}
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
