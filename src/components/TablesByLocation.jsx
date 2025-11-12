import React, { useEffect, useState, useRef, useMemo } from "react";
import PropTypes from 'prop-types';
import { LOCATIONS } from '../utils/constants.js';
import { donorStorage, safeJsonParse } from '../utils/storage.js';
import { isAnimalHighlighted } from '../utils/donorUtils.js';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { donorsToCSV, downloadCSV } from '../utils/csvExport.js';
import { searchDonors, getSearchSuggestions } from '../utils/searchUtils.js';

// Helper components for modal
const InfoItem = ({ label, value, colors, highlight = false }) => (
  <div>
    <p className={`text-xs ${colors.text.secondary} mb-1`}>{label}</p>
    <p className={`text-sm font-medium ${highlight ? 'text-purple-600 dark:text-purple-400' : colors.text.primary}`}>
      {value || '-'}
    </p>
  </div>
);

const StatusBadge = ({ label, value, colors, isMain = false }) => {
  const getStatusColor = () => {
    if (!value) return 'gray';
    const val = value.toString().toLowerCase();
    if (val === 'yes' || val === 'negative' || val === 'neg') return 'green';
    if (val === 'no' || val === 'positive' || val === 'pos') return 'red';
    return 'gray';
  };
  
  const statusColor = getStatusColor();
  const colorClasses = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  };
  
  return (
    <div>
      <p className={`text-xs ${colors.text.secondary} mb-1`}>{label}</p>
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorClasses[statusColor]}`}>
        {value || '-'}
      </span>
    </div>
  );
};

// ---------- Helper Functions ----------            💾 Export ({donors.length})rs ----------
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

const formatMonth = (monthKey) => {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  try {
    const [year, month] = monthKey.split('-');
    const date = new Date(`${year}-${month}-01`);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long'
    });
  } catch {
    return monthKey;
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

const TablesByLocation = ({ onEdit, locationFilter, monthFilter, onClearFilter }) => {
  const { colors } = useTheme();
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
  const [selectedDonors, setSelectedDonors] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const fileInputRef = useRef(null);

  // טוען מה־storage + מנרמל + דה-דופ
  useEffect(() => {
    const donorsData = donorStorage.getDonors() || [];
    const cleaned = dedupeById(donorsData).map(d => {
      const normalized = {
        ...d,
        // נוודא שדות בסיסיים כטקסט
        animalName: d.animalName ?? '',
        animalType: d.animalType ?? '',
        date: d.date ?? '',
      };

      // Fix donated field for existing data too
      if (normalized.donated !== undefined && normalized.donated !== null) {
        const donatedValue = normalized.donated.toString().trim().toLowerCase();
        if (donatedValue === 'yes' || donatedValue === 'true' || donatedValue === '1' || donatedValue === 'כן') {
          normalized.donated = 'Yes';
        } else if (donatedValue === 'no' || donatedValue === 'false' || donatedValue === '0' || donatedValue === 'לא') {
          normalized.donated = 'No';
        } else {
          // For any other case (including already correct 'Yes'/'No'), normalize to first letter uppercase
          const firstChar = donatedValue.charAt(0).toUpperCase();
          const rest = donatedValue.slice(1).toLowerCase();
          const normalized_donated = firstChar + rest;
          if (normalized_donated === 'Yes' || normalized_donated === 'No') {
            normalized.donated = normalized_donated;
          } else {
            // Default fallback - if it's not recognizable, assume 'No'
            normalized.donated = 'No';
          }
        }
      }
      
      return normalized;
    });
    setDonors(cleaned);
    donorStorage.saveDonors(cleaned); // שומר "מיגרציה" כדי למנוע חזרה לבאג
  }, []);

  // הכנת locationFilter ו-monthFilter מ-dashboard
  useEffect(() => {
    if (locationFilter) {
      setActiveLocation(locationFilter);
    }
    // monthFilter will be handled in the filtering logic, not in dateFilter
  }, [locationFilter, monthFilter]);

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
    const s = search.trim();
    const type = animalTypeFilter.trim().toLowerCase();
    const dateFilterValue = dateFilter.trim();

    // Start with location-filtered donors
    let results = donors.filter(d => normalizeLocation(d.location) === normLoc);

    // Apply fuzzy search if query exists (using Fuse.js)
    if (s && s.length >= 2) {
      results = searchDonors(results, s);
    }

    // Apply other filters
    results = results.filter((d) => {
      // Animal type filter
      if (type && (!d.animalType || d.animalType.trim().toLowerCase() !== type)) return false;

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

        // Month filter (from dashboard)
        if (monthFilter) {
          if (!d.date) return false;
          
          // Extract YYYY-MM from donor date
          let donorMonthKey = "";
          if (d.date.includes("-") && d.date.length === 10) {
            donorMonthKey = d.date.slice(0, 7); // Get YYYY-MM part
          } else if (d.date.includes("/")) {
            const [day, month, year] = d.date.split("/");
            donorMonthKey = `${year}-${month.padStart(2, "0")}`;
          }

          if (donorMonthKey !== monthFilter) return false;
        }

        return true;
      });

    // Sort by date (newest first)
    return results.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [donors, activeLocation, search, animalTypeFilter, dateFilter, monthFilter]);

  const handleDelete = (index) => {
    const toDelete = filteredDonors[index];
    if (!toDelete) return;
    
    if (window.confirm(`❌ Delete this donor?\n\nName: ${toDelete.animalName}\nType: ${toDelete.animalType}\nDate: ${toDelete.date}`)) {
      // מאתרים לפי id (יציב) במקום לפי רפרנס/אינדקס
      const updated = donors.filter(d => d.id !== toDelete.id);
      setDonors(updated);
      donorStorage.saveDonors(updated);
    }
  };

  const handleBulkDelete = () => {
    if (selectedDonors.size === 0) {
      alert('⚠️ No donors selected');
      return;
    }

    const selectedCount = selectedDonors.size;
    const selectedNames = Array.from(selectedDonors)
      .slice(0, 5)
      .map(id => {
        const donor = filteredDonors.find(d => d.id === id);
        return donor ? donor.animalName : '';
      })
      .filter(Boolean)
      .join(', ');
    
    const moreText = selectedCount > 5 ? `\n...and ${selectedCount - 5} more` : '';
    
    if (window.confirm(`❌ Delete ${selectedCount} selected donor(s)?\n\n${selectedNames}${moreText}\n\nThis action cannot be undone!`)) {
      const updated = donors.filter(d => !selectedDonors.has(d.id));
      setDonors(updated);
      donorStorage.saveDonors(updated);
      setSelectedDonors(new Set());
      setIsSelectionMode(false);
      alert(`✅ Successfully deleted ${selectedCount} donor(s)`);
    }
  };

  const toggleDonorSelection = (donorId) => {
    setSelectedDonors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(donorId)) {
        newSet.delete(donorId);
      } else {
        newSet.add(donorId);
      }
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    const allIds = new Set(filteredDonors.map(d => d.id));
    setSelectedDonors(allIds);
  };

  const clearSelection = () => {
    setSelectedDonors(new Set());
  };

  const handleExportJSON = async () => {
    try {
      const exportData = JSON.stringify(donors, null, 2);
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
      const filename = `donor_data_${dateStr}_${timeStr}.json`;
      
      // Try Capacitor Filesystem first
      try {
        await Filesystem.writeFile({
          path: filename,
          data: exportData,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        
        const privateOwnersCount = donors.filter(d => d.isPrivateOwner).length;
        alert(`✅ File saved successfully!\n\nFilename: ${filename}\nLocation: Documents\n\nTotal donors: ${donors.length}\nPrivate owners: ${privateOwnersCount}`);
        return;
      } catch (fsError) {
        console.warn('Filesystem failed:', fsError);
        
        // Fallback to clipboard
        try {
          await navigator.clipboard.writeText(exportData);
          alert(`📋 Data copied to clipboard!\n\n(File save failed, using clipboard instead)\n\nOpen a notes app and paste to save as: ${filename}`);
          return;
        } catch (clipError) {
          console.warn('Clipboard failed:', clipError);
          
          // Last resort: download in browser
          const blob = new Blob([exportData], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          alert(`� File downloaded!\n\nCheck your Downloads folder for: ${filename}`);
        }
      }
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('❌ Export failed: ' + error.message);
    }
  };

  const downloadFile = (data, filename) => {
    try {
      const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
      
      // Try modern approach first
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/json' })] })) {
        const file = new File([blob], filename, { type: 'application/json' });
        navigator.share({
          title: 'Export Donor Data',
          text: `Donor database backup - ${donors.length} records`,
          files: [file]
        }).then(() => {
          alert('✅ File shared successfully!');
        }).catch((error) => {
          console.error('Web Share API failed:', error);
          // Fallback to download
          triggerDownload(blob, filename);
        });
      } else {
        // Standard download approach
        triggerDownload(blob, filename);
      }
    } catch (error) {
      console.error('Download file failed:', error);
      alert('❌ Download failed: ' + error.message);
    }
  };

  const triggerDownload = (blob, filename) => {
    try {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
      
      alert('✅ File downloaded successfully!');
    } catch (error) {
      console.error('Trigger download failed:', error);
      alert('❌ Download trigger failed: ' + error.message);
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
              } else {
                // For any other case (including already correct 'Yes'/'No'), normalize to first letter uppercase
                const firstChar = donatedValue.charAt(0).toUpperCase();
                const rest = donatedValue.slice(1).toLowerCase();
                const normalized_donated = firstChar + rest;
                if (normalized_donated === 'Yes' || normalized_donated === 'No') {
                  normalized.donated = normalized_donated;
                } else {
                  // Default fallback - if it's not recognizable, assume 'No'
                  normalized.donated = 'No';
                }
              }
            }
            
            // Auto-mark as private owner if owner info exists
            const hasOwnerInfo = normalized.ownerName?.trim() || normalized.ownerPhone?.trim() || normalized.fileNumber?.trim();
            if (hasOwnerInfo && !normalized.isPrivateOwner) {
              normalized.isPrivateOwner = true;
            }
            
            return normalized;
          });
          const merged = dedupeById([...donors, ...withIds]);
          setDonors(merged);
          donorStorage.saveDonors(merged);
          
          const privateOwnersCount = withIds.filter(d => d.isPrivateOwner).length;
          alert(`✅ Import successful!\n\nTotal imported: ${withIds.length}\nPrivate owners: ${privateOwnersCount}`);
        } else {
          alert("❌ Invalid file format - expected JSON array");
        }
      } catch (error) {
        console.error("Import error:", error);
        alert(`❌ Error reading file\n\n${error.message || 'Invalid file'}`);
      } finally {
        // ננקה את ה-file input כדי לאפשר ייבוא מחדש של אותו קובץ אם צריך
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleRowClick = (donor) => setSelectedDonor(donor);
  const closeModal = () => setSelectedDonor(null);
  
  // Get all donations for the selected animal
  // Identify same animal by: name + location + (private owner if exists)
  const getDonationsForAnimal = (donor) => {
    if (!donor) return [];
    
    const matchKey = (d) => {
      const nameMatch = d.animalName?.toLowerCase() === donor.animalName?.toLowerCase();
      const typeMatch = d.animalType?.toLowerCase() === donor.animalType?.toLowerCase();
      const locationMatch = d.location?.toLowerCase() === donor.location?.toLowerCase();
      
      // If private owner exists, must match phone/owner name
      if (donor.isPrivateOwner) {
        const phoneMatch = donor.ownerPhone && d.ownerPhone === donor.ownerPhone;
        const ownerMatch = donor.ownerName && d.ownerName?.toLowerCase() === donor.ownerName?.toLowerCase();
        return nameMatch && typeMatch && locationMatch && (phoneMatch || ownerMatch);
      }
      
      // For non-private: name + type + location is enough
      return nameMatch && typeMatch && locationMatch;
    };
    
    return donors.filter(matchKey).sort((a, b) => {
      // Sort by date, newest first
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  };
  
  const animalDonations = selectedDonor ? getDonationsForAnimal(selectedDonor) : [];

  const handleExportCSV = async () => {
    try {
      // Export only donors from active location
      const locationDonors = donors.filter(d => normalizeLocation(d.location) === normalizeLocation(activeLocation));
      
      if (locationDonors.length === 0) {
        alert('⛔ No data to export for this location');
        return;
      }
      
      const csvContent = donorsToCSV(locationDonors);
      if (!csvContent) {
        alert('⛔ No data to export');
        return;
      }
      
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
      const locationName = activeLocation.replace(/\s+/g, '_');
      const filename = `donor_data_${locationName}_${dateStr}_${timeStr}.csv`;
      
      const success = await downloadCSV(csvContent, filename);
      
      if (!success) return;
      
      const privateOwnersCount = locationDonors.filter(d => d.isPrivateOwner).length;
      alert(`✅ CSV exported successfully!\n\nLocation: ${activeLocation}\nFile: ${filename}\nTotal donors: ${locationDonors.length}\nPrivate owners: ${privateOwnersCount}`);
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('❌ CSV export failed: ' + error.message);
    }
  };

  return (
    <div className={`p-4 max-w-7xl mx-auto ${colors.text.primary} select-none`}>
      {/* Page Title */}
      <div className="text-center mb-6">
        <h1 className={`text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3`}>
          Donors Table
        </h1>
        <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full"></div>
      </div>

      {/* Import/Export JSON - Simple and Clean */}
      <div className="flex justify-center mb-6">
        <div className={`flex items-center gap-2 ${colors.bg.tertiary} rounded-xl p-2 ${colors.border.primary} border flex-wrap justify-center`}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200"
          >
            📥 Import
          </button>
          <button
            onClick={handleExportJSON}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200"
            title={`Export ${donors.length} records to JSON file`}
          >
            💾 JSON ({donors.length})
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200"
            title={`Export donors from ${activeLocation} to CSV`}
          >
            📊 CSV ({filteredDonors.length})
          </button>
          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) {
                clearSelection();
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 ${
              isSelectionMode 
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white' 
                : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
            }`}
            title="Toggle selection mode for bulk operations"
          >
            {isSelectionMode ? '✓ Selection Mode' : '☐ Select Multiple'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportJSON}
        />
      </div>

      {/* Bulk Actions Bar */}
      {isSelectionMode && (
        <div className={`mb-4 p-3 ${colors.bg.tertiary} rounded-lg border ${colors.border.primary} flex flex-wrap items-center justify-between gap-2`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold ${colors.text.primary}`}>
              {selectedDonors.size} selected
            </span>
            <button
              onClick={selectAllFiltered}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200"
            >
              Select All ({filteredDonors.length})
            </button>
            <button
              onClick={clearSelection}
              className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200"
              disabled={selectedDonors.size === 0}
            >
              Clear Selection
            </button>
          </div>
          <button
            onClick={handleBulkDelete}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={selectedDonors.size === 0}
          >
            🗑️ Delete Selected ({selectedDonors.size})
          </button>
        </div>
      )}

      {/* Location Buttons */}
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {locationFilter && (
          <button
            onClick={() => {
              onClearFilter();
              setActiveLocation(donorStorage.getActiveLocation());
            }}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-3 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 text-sm mb-2"
            title="Clear dashboard filter and return to normal view"
          >
            ← Back to All Locations{monthFilter ? ` (from ${formatMonth(monthFilter)})` : ''}
          </button>
        )}
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
                : `${colors.bg.card} ${colors.text.primary} hover:${colors.bg.tableRowHover} shadow-md hover:shadow-lg border ${colors.border.primary}`
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
            <label htmlFor="animalTypeSelect" className={`font-medium ${colors.text.primary} whitespace-nowrap`}>Animal Type:</label>
            <select
              id="animalTypeSelect"
              value={animalTypeFilter}
              onChange={e => setAnimalTypeFilter(e.target.value)}
              className={`flex-1 sm:flex-none border ${colors.border.input} rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 ${colors.border.focus} text-sm ${colors.bg.input} ${colors.text.primary}`}
            >
              <option value="">All Animals</option>
              {animalTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="dateInput" className={`font-medium ${colors.text.primary} whitespace-nowrap`}>Date:</label>
            <input
              id="dateInput"
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className={`flex-1 sm:flex-none border ${colors.border.input} rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 ${colors.border.focus} text-sm min-w-[140px] ${colors.bg.input} ${colors.text.primary}`}
            />
          </div>
          
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search any field..."
            className={`flex-1 border ${colors.border.input} rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 ${colors.border.focus} text-sm ${colors.bg.input} ${colors.text.primary} ${colors.text.placeholder}`}
          />
          
          {(search || animalTypeFilter || dateFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setAnimalTypeFilter("");
                setDateFilter("");
              }}
              className={`px-4 py-2 text-sm bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-lg transition-all duration-200 whitespace-nowrap font-medium shadow-md hover:shadow-lg`}
              title="Clear all filters"
            >
              🗑️ Clear All
            </button>
          )}
        </div>
        
        {/* Results count */}
        {(search || animalTypeFilter || dateFilter) && (
          <div className={`text-center text-sm ${colors.text.secondary} ${colors.bg.tertiary} rounded-lg p-2`}>
            Showing {filteredDonors.length} results
            {search && ` • Search: "${search}"`}
            {animalTypeFilter && ` • ${animalTypeFilter}`}
            {dateFilter && ` • ${formatDate(dateFilter)}`}
          </div>
        )}
      </div>

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-4">
        {filteredDonors.length === 0 ? (
          <div className={`text-center py-12 ${colors.text.muted}`}>
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-lg font-semibold mb-2">No data to display</p>
            {(search || animalTypeFilter || dateFilter) ? (
              <p className="text-sm">Try changing or clearing the filters</p>
            ) : (
              <p className="text-sm">Add donors using the form</p>
            )}
          </div>
        ) : (
          filteredDonors.map((d, index) => (
            <div
              key={d.id}
              className={`rounded-lg shadow-md border-l-4 p-4 cursor-pointer transition-all duration-200 hover:shadow-lg relative
                ${isAnimalHighlighted(d, removedHighlights)
                  ? (colors.isDarkMode
                      ? `${colors.bg.card} border-l-green-400`
                      : `${colors.bg.card} border-l-green-500`)
                  : (colors.isDarkMode
                      ? `${colors.bg.card} border-l-blue-400`
                      : `${colors.bg.card} border-l-blue-500`)
                }
                ${colors.text.primary}
                ${isSelectionMode && selectedDonors.has(d.id) ? 'ring-2 ring-blue-500' : ''}
              `}
              onClick={() => {
                if (isSelectionMode) {
                  toggleDonorSelection(d.id);
                } else {
                  handleRowClick(d);
                }
              }}
            >
              {isSelectionMode && (
                <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedDonors.has(d.id)}
                    onChange={() => toggleDonorSelection(d.id)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className="flex justify-between items-start mb-3">
                <div className={isSelectionMode ? 'ml-8' : ''}>
                  <h3 className={`font-bold text-lg ${colors.text.primary}`}>{d.animalName}</h3>
                  <p className={`text-sm ${colors.text.secondary}`}>{d.animalType} • {d.bloodType}</p>
                </div>
                {!isSelectionMode && (
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
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className={colors.text.muted}>Date:</span>
                  <p className={`font-medium ${colors.text.primary}`}>{d.date}</p>
                </div>
                <div>
                  <span className={colors.text.muted}>PCV:</span>
                  <p className={`font-medium ${colors.text.primary}`}>{d.pcv}</p>
                </div>
                <div>
                  <span className={colors.text.muted}>Donated:</span>
                  <p className={`font-medium ${colors.text.primary}`}>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      d.donated === 'Yes'
                        ? (colors.isDarkMode ? 'bg-green-900/60 text-green-200' : 'bg-green-100 text-green-800')
                        : (colors.isDarkMode ? 'bg-red-900/60 text-red-200' : 'bg-red-100 text-red-800')
                    }`}>
                      {d.donated}
                    </span>
                  </p>
                </div>
                <div>
                  <span className={colors.text.muted}>Next Eligible:</span>
                  <p className={`font-medium ${colors.text.primary} text-xs`}>
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
      <div className={`hidden md:block ${colors.bg.card} rounded-lg shadow-lg overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={`${colors.bg.tertiary} border-b ${colors.border.primary}`}>
              <tr>
                {isSelectionMode && (
                  <th className={`px-4 py-3 text-center font-semibold ${colors.text.primary}`}>
                    <input
                      type="checkbox"
                      checked={filteredDonors.length > 0 && selectedDonors.size === filteredDonors.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllFiltered();
                        } else {
                          clearSelection();
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className={`px-4 py-3 text-left font-semibold ${colors.text.primary}`}>#</th>
                {!isSelectionMode && <th className={`px-4 py-3 text-center font-semibold ${colors.text.primary}`}>Actions</th>}
                <th className={`px-4 py-3 text-left font-semibold ${colors.text.primary}`}>Date</th>
                <th className={`px-4 py-3 text-left font-semibold ${colors.text.primary}`}>Animal Name</th>
                <th className={`px-4 py-3 text-left font-semibold ${colors.text.primary}`}>Animal Type</th>
                <th className={`px-4 py-3 text-left font-semibold ${colors.text.primary}`}>Blood Type</th>
                <th className={`px-4 py-3 text-left font-semibold ${colors.text.primary}`}>PCV</th>
                <th className={`px-4 py-3 text-center font-semibold ${colors.text.primary}`}>Donated?</th>
                <th className={`px-4 py-3 text-left font-semibold ${colors.text.primary}`}>Next Eligible Date</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${colors.border.primary} ${colors.isDarkMode ? 'bg-gray-900/80' : ''}`}>
              {filteredDonors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-4">🔍</div>
                    <p className="text-lg font-semibold mb-2">No data to display</p>
                    {(search || animalTypeFilter || dateFilter) ? (
                      <p className="text-sm">Try changing or clearing the filters</p>
                    ) : (
                      <p className="text-sm">Add donors using the form</p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredDonors.map((d, i) => (
                  <tr
                    key={d.id}
                    className={`cursor-pointer transition-colors duration-200 ${
                      isAnimalHighlighted(d, removedHighlights)
                        ? (colors.isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50')
                        : (colors.isDarkMode ? 'hover:bg-gray-800/80' : 'hover:bg-gray-50')
                    } ${isSelectionMode && selectedDonors.has(d.id) ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleDonorSelection(d.id);
                      } else {
                        handleRowClick(d);
                      }
                    }}
                  >
                    {isSelectionMode && (
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedDonors.has(d.id)}
                          onChange={() => toggleDonorSelection(d.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    <td className={`${colors.text.primary} px-4 py-3`}>{i + 1}</td>
                    {!isSelectionMode && (
                      <td className={`px-4 py-3`} onClick={e => e.stopPropagation()}>
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
                    )}
                    <td className={`${colors.text.primary} px-4 py-3`}>{d.date}</td>
                    <td className={`font-medium ${colors.text.primary} px-4 py-3`}>{d.animalName}</td>
                    <td className={`${colors.text.primary} px-4 py-3`}>{d.animalType}</td>
                    <td className={`${colors.text.primary} px-4 py-3`}>{d.bloodType}</td>
                    <td className={`${colors.text.primary} px-4 py-3`}>{d.pcv}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        d.donated === 'Yes'
                          ? (colors.isDarkMode ? 'bg-green-900/60 text-green-200' : 'bg-green-100 text-green-800')
                          : (colors.isDarkMode ? 'bg-red-900/60 text-red-200' : 'bg-red-100 text-red-800')
                      }`}>
                        {d.donated}
                      </span>
                    </td>
                    <td className={`${colors.text.primary} px-4 py-3 text-sm`}>
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

      {/* MODAL - Redesigned with modern card layout */}
      {selectedDonor && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4"
          onClick={closeModal}
        >
          <div
            className={`${colors.bg.card} rounded-2xl max-w-4xl w-full shadow-2xl relative max-h-[90vh] overflow-hidden`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 relative">
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-white/90 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all"
              >
                ✕
              </button>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-3xl">
                    {selectedDonor.animalType === 'Dog' ? '🐕' : '🐈'}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{selectedDonor.animalName}</h3>
                    <p className="text-white/80 text-sm">{selectedDonor.animalType} • {animalDonations.length} donation{animalDonations.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    closeModal();
                    // Navigate to form with only permanent fields (no test results)
                    if (onEdit) {
                      const permanentFields = {
                        animalName: selectedDonor.animalName,
                        animalType: selectedDonor.animalType,
                        location: selectedDonor.location,
                        bloodType: selectedDonor.bloodType,
                        weight: selectedDonor.weight,
                        age: selectedDonor.age,
                        gender: selectedDonor.gender,
                        isPrivateOwner: selectedDonor.isPrivateOwner,
                        ownerName: selectedDonor.ownerName,
                        ownerPhone: selectedDonor.ownerPhone,
                        // Don't include test results: pcv, hct, wbc, plt, fiv, felv, donated, volume, etc.
                      };
                      onEdit(permanentFields);
                    }
                  }}
                  className="bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2"
                >
                  <span>➕</span> Add Donation
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-4">
              {/* Previous Donations List */}
              {animalDonations.length > 1 && (
                <div className={`${colors.bg.secondary} rounded-xl p-4 border ${colors.border.primary}`}>
                  <h4 className={`text-sm font-bold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                    <span>📜</span> Donation History ({animalDonations.length} total)
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {animalDonations.map((donation, idx) => (
                      <div 
                        key={donation.id || idx}
                        className={`${colors.bg.primary} p-3 rounded-lg border ${colors.border.primary} cursor-pointer hover:shadow-md transition-shadow ${donation.id === selectedDonor.id ? 'ring-2 ring-purple-500' : ''}`}
                        onClick={() => setSelectedDonor(donation)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`text-2xl ${donation.id === selectedDonor.id ? 'scale-110' : ''}`}>
                              {donation.donated?.toLowerCase() === 'yes' || donation.donated?.toLowerCase() === 'כן' ? '✅' : '❌'}
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${colors.text.primary}`}>{donation.date || 'No date'}</p>
                              <p className={`text-xs ${colors.text.secondary}`}>{donation.location || 'Unknown location'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {donation.volume && (
                              <p className={`text-sm font-medium ${colors.text.primary}`}>{donation.volume} ml</p>
                            )}
                            {donation.bloodType && (
                              <p className={`text-xs ${colors.text.secondary}`}>Type: {donation.bloodType}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Current Donation Details Header */}
              {animalDonations.length > 1 && (
                <div className={`${colors.bg.tertiary} rounded-lg p-3 border-l-4 border-purple-500`}>
                  <p className={`text-sm font-semibold ${colors.text.primary}`}>
                    📍 Viewing donation from: {selectedDonor.date || 'No date'}
                  </p>
                </div>
              )}
              
              {/* Basic Info Card */}
              <div className={`${colors.bg.secondary} rounded-xl p-4 border ${colors.border.primary}`}>
                <h4 className={`text-sm font-bold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                  <span>📋</span> Basic Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label="Date" value={selectedDonor.date} colors={colors} />
                  <InfoItem label="Location" value={selectedDonor.location} colors={colors} />
                  <InfoItem label="Age" value={selectedDonor.age} colors={colors} />
                  <InfoItem label="Weight" value={selectedDonor.weight} colors={colors} />
                  <InfoItem label="Gender" value={selectedDonor.gender} colors={colors} />
                  <InfoItem label="Private Owner" value={selectedDonor.isPrivateOwner ? "Yes" : "No"} colors={colors} />
                </div>
              </div>

              {/* Blood Work Card */}
              <div className={`${colors.bg.secondary} rounded-xl p-4 border ${colors.border.primary}`}>
                <h4 className={`text-sm font-bold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                  <span>🩸</span> Blood Work Results
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label="Blood Type" value={selectedDonor.bloodType} colors={colors} highlight />
                  <InfoItem label="PCV" value={selectedDonor.pcv} colors={colors} />
                  <InfoItem label="HCT" value={selectedDonor.hct} colors={colors} />
                  <InfoItem label="WBC" value={selectedDonor.wbc} colors={colors} />
                  <InfoItem label="PLT" value={selectedDonor.plt} colors={colors} />
                  <InfoItem label="Packed Cell" value={selectedDonor.packedCell} colors={colors} />
                </div>
                {selectedDonor.slideFindings && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className={`text-xs ${colors.text.secondary} mb-1`}>Slide Findings</p>
                    <p className={`text-sm ${colors.text.primary}`}>{selectedDonor.slideFindings}</p>
                  </div>
                )}
              </div>

              {/* Disease Status Card (for cats) */}
              {selectedDonor.animalType === 'Cat' && (
                <div className={`${colors.bg.secondary} rounded-xl p-4 border ${colors.border.primary}`}>
                  <h4 className={`text-sm font-bold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                    <span>🔬</span> Disease Testing
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <StatusBadge label="FIV" value={selectedDonor.fiv} colors={colors} />
                    <StatusBadge label="FeLV" value={selectedDonor.felv} colors={colors} />
                  </div>
                </div>
              )}

              {/* Donation Info Card */}
              <div className={`${colors.bg.secondary} rounded-xl p-4 border ${colors.border.primary}`}>
                <h4 className={`text-sm font-bold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                  <span>💉</span> Donation Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <StatusBadge label="Donated" value={selectedDonor.donated} colors={colors} isMain />
                  <InfoItem label="Volume" value={selectedDonor.volume} colors={colors} />
                </div>
                {selectedDonor.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className={`text-xs ${colors.text.secondary} mb-1`}>Notes</p>
                    <p className={`text-sm ${colors.text.primary}`}>{selectedDonor.notes}</p>
                  </div>
                )}
              </div>

              {/* Highlight Removal Button */}
              {isAnimalHighlighted(selectedDonor, removedHighlights) && (
                <button
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
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
