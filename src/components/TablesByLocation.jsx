// כל הקוד כאן, עם השיפורים (ראה הודעות קודמות). 
// הדגש: אין כפתור "Remove Highlight" בטבלה, רק ב-Modal!
// שים לב: כותרות באנגלית.
// שאר הפיצ’רים כמו שהיו.

import React, { useEffect, useState, useRef } from "react";
import PropTypes from 'prop-types';
import { LOCATIONS } from '../utils/constants.js';
import { donorStorage, safeJsonParse } from '../utils/storage.js';
import { isAnimalHighlighted } from '../utils/donorUtils.js';

const TablesByLocation = ({ onEdit }) => {
  const [donors, setDonors] = useState([]);
  const [activeLocation, setActiveLocation] = useState(() => {
    return donorStorage.getActiveLocation();
  });
  const [search, setSearch] = useState("");
  const [animalTypeFilter, setAnimalTypeFilter] = useState("");
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [removedHighlights, setRemovedHighlights] = useState(() => {
    return donorStorage.getRemovedHighlights();
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    const donorsData = donorStorage.getDonors();
    setDonors(donorsData);
  }, []);

  const animalTypesMap = new Map();
  donors.forEach(d => {
    if (!d.animalType) return;
    const key = d.animalType.trim().toLowerCase();
    if (!animalTypesMap.has(key)) animalTypesMap.set(key, d.animalType.trim());
  });
  const animalTypes = Array.from(animalTypesMap.values());

  const handleLocationChange = (loc) => {
    setActiveLocation(loc);
    donorStorage.saveActiveLocation(loc);
  };

  const addRemovedHighlight = (id) => {
    const updated = Array.from(new Set([...removedHighlights, id]));
    setRemovedHighlights(updated);
    donorStorage.saveRemovedHighlights(updated);
  };

  const filteredDonors = donors
    .slice()
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .filter(
      (d) =>
        d.location === activeLocation &&
        (!animalTypeFilter ||
          (d.animalType &&
           d.animalType.trim().toLowerCase() === animalTypeFilter.trim().toLowerCase())) &&
        (!search ||
          (typeof d.animalName === "string"
            ? d.animalName.toLowerCase()
            : ""
          ).includes(search.toLowerCase()))
    );

  const handleDelete = (index) => {
    if (window.confirm("Delete this donor?")) {
      const realIndex = donors.findIndex((x) => x === filteredDonors[index]);
      const updated = [...donors];
      updated.splice(realIndex, 1);
      setDonors(updated);
      donorStorage.saveDonors(updated);
    }
  };

  const handleImportJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = safeJsonParse(e.target.result, null);
        if (Array.isArray(imported)) {
          const merged = [...donors, ...imported];
          setDonors(merged);
          donorStorage.saveDonors(merged);
          alert("✅ JSON import succeeded");
        } else {
          alert("❌ Invalid file format - expected JSON array");
        }
      } catch (error) {
        console.error("Import error:", error);
        alert("❌ Error reading file");
      }
    };
    reader.readAsText(file);
  };

  const handleRowClick = (donor) => setSelectedDonor(donor);
  const closeModal = () => setSelectedDonor(null);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-4">Tables by Location</h2>

      {/* Import JSON */}
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportJSON}
        />
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {LOCATIONS.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocationChange(loc)}
            className={`px-4 py-2 rounded ${
              activeLocation === loc ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            {loc}
          </button>
        ))}
      </div>

      {/* Animal Type Filter */}
      <div className="max-w-md mx-auto mb-2 flex flex-row gap-2 items-center">
        <label htmlFor="animalTypeSelect">Animal Type:</label>
        <select
          id="animalTypeSelect"
          value={animalTypeFilter}
          onChange={e => setAnimalTypeFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
        >
          <option value="">All</option>
          {animalTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="max-w-md mx-auto mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by animal name..."
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded">
        <table className="min-w-full text-sm text-center border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 w-10">#</th>
              <th className="border px-1 py-1 w-14">Actions</th>
              <th className="border px-2 py-1">Date</th>
              <th className="border px-2 py-1">Animal Name</th>
              <th className="border px-2 py-1">Animal Type</th>
              <th className="border px-2 py-1">Blood Type</th>
              <th className="border px-2 py-1">PCV</th>
              <th className="border px-2 py-1">Donated?</th>
              <th className="border px-2 py-1">Next Eligible Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredDonors.map((d, i) => (
              <tr
                key={d.id ?? i}
                className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${isAnimalHighlighted(d, removedHighlights) ? "bg-yellow-200" : ""}`}
                onClick={() => handleRowClick(d)}
                style={{ cursor: "pointer" }}
              >
                <td className="border px-2 py-1">{i + 1}</td>
                <td
                  className="border px-1 py-1"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="text-blue-600 underline cursor-pointer"
                      onClick={() => onEdit(d)}
                    >
                      Edit
                    </span>
                    <span
                      className="text-red-600 underline cursor-pointer"
                      onClick={() => handleDelete(i)}
                    >
                      Delete
                    </span>
                  </div>
                </td>
                <td className="border px-2 py-1">{d.date}</td>
                <td className="border px-2 py-1">{d.animalName}</td>
                <td className="border px-2 py-1">{d.animalType}</td>
                <td className="border px-2 py-1">{d.bloodType}</td>
                <td className="border px-2 py-1">{d.pcv}</td>
                <td className="border px-2 py-1">{d.donated}</td>
                <td className="border px-2 py-1">
                  {(() => {
                    if (!d.date) return "";
                    const date = new Date(d.date);
                    if (isNaN(date)) return "";
                    const eligible = new Date(date.setDate(date.getDate() + 90));
                    return eligible.toISOString().slice(0, 10);
                  })()}
                </td>
              </tr>
            ))}
            {filteredDonors.length === 0 && (
              <tr>
                <td colSpan={9} className="py-4 text-gray-500">
                  No data to display
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {/* MODAL */}
      {selectedDonor && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center"
          onClick={closeModal}
        >
          <div
            className="bg-white p-6 rounded-lg max-w-xl w-full shadow-lg relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute top-2 left-2 text-gray-500 text-xl font-bold"
            >
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">Animal Details</h3>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {selectedDonor.id && (
                    <tr>
                      <td className="font-bold border-b px-2 py-1 w-40 bg-gray-50">ID</td>
                      <td className="border-b px-2 py-1">{selectedDonor.id}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Date</td>
                    <td className="border-b px-2 py-1">{selectedDonor.date}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Location</td>
                    <td className="border-b px-2 py-1">{selectedDonor.location}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Animal Name</td>
                    <td className="border-b px-2 py-1">{selectedDonor.animalName}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Age</td>
                    <td className="border-b px-2 py-1">{selectedDonor.age}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Weight</td>
                    <td className="border-b px-2 py-1">{selectedDonor.weight}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Gender</td>
                    <td className="border-b px-2 py-1">{selectedDonor.gender}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Animal Type</td>
                    <td className="border-b px-2 py-1">{selectedDonor.animalType}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Blood Type</td>
                    <td className="border-b px-2 py-1">{selectedDonor.bloodType}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">FIV Status</td>
                    <td className="border-b px-2 py-1">{selectedDonor.fiv}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">FeLV Status</td>
                    <td className="border-b px-2 py-1">{selectedDonor.felv}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">PCV</td>
                    <td className="border-b px-2 py-1">{selectedDonor.pcv}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">HCT</td>
                    <td className="border-b px-2 py-1">{selectedDonor.hct}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">WBC</td>
                    <td className="border-b px-2 py-1">{selectedDonor.wbc}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">PLT</td>
                    <td className="border-b px-2 py-1">{selectedDonor.plt}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Packed Cell</td>
                    <td className="border-b px-2 py-1">{selectedDonor.packedCell}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Slide Findings</td>
                    <td className="border-b px-2 py-1">{selectedDonor.slideFindings}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Donated?</td>
                    <td className="border-b px-2 py-1">{selectedDonor.donated}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Volume</td>
                    <td className="border-b px-2 py-1">{selectedDonor.volume}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Notes</td>
                    <td className="border-b px-2 py-1">{selectedDonor.notes}</td>
                  </tr>
                  <tr>
                    <td className="font-bold border-b px-2 py-1 bg-gray-50">Private Owner?</td>
                    <td className="border-b px-2 py-1">{selectedDonor.isPrivateOwner ? "Yes" : "No"}</td>
                  </tr>
                </tbody>
              </table>
              {/* Remove Highlight button – ONLY if highlighted */}
              {isAnimalHighlighted(selectedDonor, removedHighlights) && (
                <button
                  className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded my-4 block mx-auto"
                  onClick={() => {
                    addRemovedHighlight(selectedDonor.id);
                    closeModal();
                  }}
                >
                  Remove Highlight
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

TablesByLocation.propTypes = {
  onEdit: PropTypes.func.isRequired,
};

export default TablesByLocation;
