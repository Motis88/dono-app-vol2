import React, { useEffect, useState, useRef, useMemo } from "react";
import PropTypes from 'prop-types';
import { LOCATIONS } from '../utils/constants.js';
import { donorStorage, safeJsonParse } from '../utils/storage.js';
import { isAnimalHighlighted } from '../utils/donorUtils.js';

// ---------- Helpers ----------
const normalizeLocation = (loc) =>
  (loc ?? '').toString().trim();

const formatDate = (dateKey) => {
  if (!dateKey || !dateKey.includes('-')) return dateKey;
  try {
    const date = new Date(dateKey);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateKey;
  }
};

const buildHeuristicId = (d) => {
  // fallback אם אין id היסטורי
  const parts = [
    normalizeLocation(d.location),
    (d.animalName ?? '').toString().trim().toLowerCase(),
    (d.date ?? '').toString().trim(),
    (d.animalType ?? '').toString().trim().toLowerCase(),
  ];
  return parts.join('|');
};

const withStableId = (d) => {
  if (d?.id && typeof d.id === 'string' && d.id.trim()) {
    return { ...d, id: d.id.trim(), location: normalizeLocation(d.location) };
  }
  // אם יש id מספרי – ננרמל למחרוזת
  if (Number.isFinite(d?.id)) {
    return { ...d, id: String(d.id), location: normalizeLocation(d.location) };
  }
  // אחרת – נייצר id
  const heuristic = buildHeuristicId(d);
  const fallback = (globalThis.crypto?.randomUUID?.() ?? `gen-${Math.random().toString(36).slice(2)}`);
  const newId = heuristic || fallback;
  return { ...d, id: newId, location: normalizeLocation(d.location) };
};

const dedupeById = (arr) => {
  const map = new Map();
  for (const raw of arr) {
    const d = withStableId(raw);
    // אם כבר קיים אותו id – שמרנו את האחרון (או תוכל לשנות ל"שמור ראשון")
    map.set(d.id, d);
  }
  return [...map.values()];
};
// --------------------------------

const TablesByLocation = ({ onEdit }) => {
  const [donors, setDonors] = useState([]);
  const [activeLocation, setActiveLocation] = useState(() => {
    return donorStorage.getActiveLocation();
  });
  const [search, setSearch] = useState("");
  const [animalTypeFilter, setAnimalTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [removedHighlights, setRemovedHighlights] = useState(() => {
    return donorStorage.getRemovedHighlights();
  });
  const fileInputRef = useRef(null);

  // טוען מה־storage + מנרמל + דה-דופ
  useEffect(() => {
    const donorsData = donorStorage.getDonors() || [];
    const cleaned = dedupeById(donorsData).map(d => ({
      ...d,
      // נוודא שדות בסיסיים כטקסט
      animalName: d.animalName ?? '',
      animalType: d.animalType ?? '',
      date: d.date ?? '',
    }));
    setDonors(cleaned);
    donorStorage.saveDonors(cleaned); // שומר "מיגרציה" כדי למנוע חזרה לבאג
  }, []);

  // מפות סוגי בעלי חיים (בכל הדאטה; אפשר להגביל ל-filteredDonors אם תרצה)
  const animalTypes = useMemo(() => {
    const map = new Map();
    for (const d of donors) {
      if (!d.animalType) continue;
      const key = d.animalType.trim().toLowerCase();
      if (!map.has(key)) map.set(key, d.animalType.trim());
    }
    return [...map.values()];
  }, [donors]);

  // חילוץ תאריכים זמינים מהנתונים
  const availableDates = useMemo(() => {
    const datesSet = new Set();
    for (const d of donors) {
      if (!d.date) continue;
      
      let dateKey = "";
      if (d.date.includes("-") && d.date.length === 10) {
        dateKey = d.date; // Already in YYYY-MM-DD format
      } else if (d.date.includes("/")) {
        const [day, month, year] = d.date.split("/");
        dateKey = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      
      if (dateKey) datesSet.add(dateKey);
    }
    
    return [...datesSet].sort().reverse(); // החדשים ביותר למעלה
  }, [donors]);

  const handleLocationChange = (loc) => {
    const norm = normalizeLocation(loc);
    setActiveLocation(norm);
    donorStorage.saveActiveLocation(norm);
    setSelectedDonor(null); // חשוב: לא להשאיר מודל של מסך קודם
  };

  const addRemovedHighlight = (id) => {
    const updated = Array.from(new Set([...removedHighlights, id]));
    setRemovedHighlights(updated);
    donorStorage.saveRemovedHighlights(updated);
  };

  const filteredDonors = useMemo(() => {
    const normLoc = normalizeLocation(activeLocation);
    const s = search.trim().toLowerCase();
    const type = animalTypeFilter.trim().toLowerCase();
    const dateFilterValue = dateFilter.trim();

    return donors
      .slice()
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .filter((d) => {
        // Location filter
        if (normalizeLocation(d.location) !== normLoc) return false;
        
        // Animal type filter
        if (type && (!d.animalType || d.animalType.trim().toLowerCase() !== type)) return false;
        
        // Search filter
        if (s && !(typeof d.animalName === "string" ? d.animalName.toLowerCase() : "").includes(s)) return false;
        
        // Date filter
        if (dateFilterValue) {
          if (!d.date) return false;
          
          // Normalize the donor date to YYYY-MM-DD format for comparison
          let donorDateKey = "";
          if (d.date.includes("-") && d.date.length === 10) {
            donorDateKey = d.date; // Already in YYYY-MM-DD format
          } else if (d.date.includes("/")) {
            const [day, month, year] = d.date.split("/");
            donorDateKey = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
          
          if (donorDateKey !== dateFilterValue) return false;
        }
        
        return true;
      });
  }, [donors, activeLocation, search, animalTypeFilter, dateFilter]);

  const handleDelete = (index) => {
    if (window.confirm("Delete this donor?")) {
      // מאתרים לפי id (יציב) במקום לפי רפרנס/אינדקס
      const toDelete = filteredDonors[index];
      if (!toDelete) return;
      const updated = donors.filter(d => d.id !== toDelete.id);
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
          const withIds = imported.map(item => {
            const normalized = withStableId(item);
            // Fix the donated field to ensure proper values - more thorough check
            if (normalized.donated !== undefined && normalized.donated !== null) {
              const donatedValue = normalized.donated.toString().trim().toLowerCase();
              if (donatedValue === 'yes' || donatedValue === 'true' || donatedValue === '1' || donatedValue === 'כן') {
                normalized.donated = 'Yes';
              } else if (donatedValue === 'no' || donatedValue === 'false' || donatedValue === '0' || donatedValue === 'לא') {
                normalized.donated = 'No';
              } else if (donatedValue !== 'yes' && donatedValue !== 'no') {
                // Keep the original capitalized format if it's already correct
                normalized.donated = normalized.donated.toString().trim();
              }
            }
            return normalized;
          });
          const merged = dedupeById([...donors, ...withIds]);
          setDonors(merged);
          donorStorage.saveDonors(merged);
          alert("✅ JSON import succeeded");
        } else {
          alert("❌ Invalid file format - expected JSON array");
        }
      } catch (error) {
        console.error("Import error:", error);
        alert("❌ Error reading file");
      } finally {
        // ננקה את ה-file input כדי לאפשר ייבוא מחדש של אותו קובץ אם צריך
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleRowClick = (donor) => setSelectedDonor(donor);
  const closeModal = () => setSelectedDonor(null);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Removed the testing message line */}

      {/* Import JSON */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
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

      {/* Location Buttons */}
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {LOCATIONS.filter(loc => loc !== "תל אביב").sort((a, b) => {
          if (a === "בית עובד") return -1;
          if (b === "בית עובד") return 1;
          if (a === "רחובות") return 1;
          if (b === "רחובות") return -1;
          return 0;
        }).map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocationChange(loc)}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
              normalizeLocation(activeLocation) === normalizeLocation(loc)
                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 shadow-md hover:shadow-lg border border-gray-200"
            }`}
          >
            {loc}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="max-w-4xl mx-auto mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="animalTypeSelect" className="font-medium text-gray-700 whitespace-nowrap">Animal Type:</label>
            <select
              id="animalTypeSelect"
              value={animalTypeFilter}
              onChange={e => setAnimalTypeFilter(e.target.value)}
              className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Animals</option>
              {animalTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="dateInput" className="font-medium text-gray-700 whitespace-nowrap">Date:</label>
            <input
              id="dateInput"
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-w-[140px]"
            />
          </div>
          
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by animal name..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          
          {(search || animalTypeFilter || dateFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setAnimalTypeFilter("");
                setDateFilter("");
              }}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 whitespace-nowrap"
              title="Clear all filters"
            >
              Clear All
            </button>
          )}
        </div>
        
        {/* Results count */}
        {(search || animalTypeFilter || dateFilter) && (
          <div className="text-center text-sm text-gray-600 bg-blue-50 rounded-lg p-2">
            Showing {filteredDonors.length} results
            {search && ` matching "${search}"`}
            {animalTypeFilter && ` • ${animalTypeFilter} only`}
            {dateFilter && ` • ${formatDate(dateFilter)} only`}
          </div>
        )}
      </div>

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-4">
        {filteredDonors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4">🔍</div>
            <p>No data to display</p>
          </div>
        ) : (
          filteredDonors.map((d, index) => (
            <div
              key={d.id}
              className={`bg-white rounded-lg shadow-md border-l-4 p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                isAnimalHighlighted(d, removedHighlights) 
                  ? "border-l-yellow-500 bg-yellow-50" 
                  : "border-l-blue-500"
              }`}
              onClick={() => handleRowClick(d)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{d.animalName}</h3>
                  <p className="text-sm text-gray-600">{d.animalType} • {d.bloodType}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(d);
                    }}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(index);
                    }}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Date:</span>
                  <p className="font-medium">{d.date}</p>
                </div>
                <div>
                  <span className="text-gray-500">PCV:</span>
                  <p className="font-medium">{d.pcv}</p>
                </div>
                <div>
                  <span className="text-gray-500">Donated:</span>
                  <p className="font-medium">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      d.donated === 'Yes' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {d.donated}
                    </span>
                    </p>
                </div>
                <div>
                  <span className="text-gray-500">Next Eligible:</span>
                  <p className="font-medium text-xs">
                    {(() => {
                      if (!d.date) return "N/A";
                      const date = new Date(d.date);
                      if (isNaN(date)) return "N/A";
                      const eligible = new Date(date);
                      eligible.setDate(eligible.getDate() + 90);
                      return eligible.toISOString().slice(0, 10);
                    })()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Animal Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Animal Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Blood Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">PCV</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Donated?</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Next Eligible Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDonors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-4">🔍</div>
                    <p>No data to display</p>
                  </td>
                </tr>
              ) : (
                filteredDonors.map((d, i) => (
                  <tr
                    key={d.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${
                      isAnimalHighlighted(d, removedHighlights) ? "bg-yellow-50" : ""
                    }`}
                    onClick={() => handleRowClick(d)}
                  >
                    <td className="px-4 py-3 text-gray-700">{i + 1}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => onEdit(d)}
                          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(i)}
                          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{d.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{d.animalName}</td>
                    <td className="px-4 py-3 text-gray-700">{d.animalType}</td>
                    <td className="px-4 py-3 text-gray-700">{d.bloodType}</td>
                    <td className="px-4 py-3 text-gray-700">{d.pcv}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        d.donated === 'Yes' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {d.donated}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-sm">
                      {(() => {
                        if (!d.date) return "";
                        const date = new Date(d.date);
                        if (isNaN(date)) return "";
                        const eligible = new Date(date);
                        eligible.setDate(eligible.getDate() + 90);
                        return eligible.toISOString().slice(0, 10);
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Date</td><td className="border-b px-2 py-1">{selectedDonor.date}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Location</td><td className="border-b px-2 py-1">{selectedDonor.location}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Animal Name</td><td className="border-b px-2 py-1">{selectedDonor.animalName}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Age</td><td className="border-b px-2 py-1">{selectedDonor.age}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Weight</td><td className="border-b px-2 py-1">{selectedDonor.weight}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Gender</td><td className="border-b px-2 py-1">{selectedDonor.gender}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Animal Type</td><td className="border-b px-2 py-1">{selectedDonor.animalType}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Blood Type</td><td className="border-b px-2 py-1">{selectedDonor.bloodType}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">FIV Status</td><td className="border-b px-2 py-1">{selectedDonor.fiv}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">FeLV Status</td><td className="border-b px-2 py-1">{selectedDonor.felv}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">PCV</td><td className="border-b px-2 py-1">{selectedDonor.pcv}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">HCT</td><td className="border-b px-2 py-1">{selectedDonor.hct}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">WBC</td><td className="border-b px-2 py-1">{selectedDonor.wbc}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">PLT</td><td className="border-b px-2 py-1">{selectedDonor.plt}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Packed Cell</td><td className="border-b px-2 py-1">{selectedDonor.packedCell}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Slide Findings</td><td className="border-b px-2 py-1">{selectedDonor.slideFindings}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Donated?</td><td className="border-b px-2 py-1">{selectedDonor.donated}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Volume</td><td className="border-b px-2 py-1">{selectedDonor.volume}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Notes</td><td className="border-b px-2 py-1">{selectedDonor.notes}</td></tr>
                  <tr><td className="font-bold border-b px-2 py-1 bg-gray-50">Private Owner?</td><td className="border-b px-2 py-1">{selectedDonor.isPrivateOwner ? "Yes" : "No"}</td></tr>
                </tbody>
              </table>

              {isAnimalHighlighted(selectedDonor, removedHighlights) && (
                <button
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 my-4 block mx-auto"
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
