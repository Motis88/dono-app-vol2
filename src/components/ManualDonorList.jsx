
import React, { useState, useEffect } from "react";
import { donorStorage } from '../utils/storage.js';
import { isAnimalHighlighted, normalizeBloodType } from '../utils/donorUtils.js';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { BLOOD_TYPES } from '../utils/constants.js';

// Helper to uniquely match animal records
function isSameAnimal(a, b) {
  if (!a || !b) return false;
  return (
    a.animalName === b.animalName &&
    a.ownerName === b.ownerName &&
    (a.fileNumber ? a.fileNumber === b.fileNumber : true)
  );
}

const ManualDonorList = ({ onEdit, onNewDonation }) => {
  const { colors } = useTheme();
  const [donors, setDonors] = useState([]);
  const [showProfile, setShowProfile] = useState(null);
  const [bloodTypeFilter, setBloodTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showReady, setShowReady] = useState(true);
  const [showSoon, setShowSoon] = useState(false);
  const [showNotReady, setShowNotReady] = useState(false);

  useEffect(() => {
    refreshDonors();
    // eslint-disable-next-line
  }, [bloodTypeFilter, searchQuery]);

  // Calculate donation eligibility status
  const calculateDonationStatus = (lastDonationDate) => {
    if (!lastDonationDate) {
      return { status: 'ready', daysStatus: 'No previous donation', canDonate: true, daysUntilReady: 0 };
    }

    const lastDate = new Date(lastDonationDate);
    const today = new Date();
    const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    const daysUntilReady = Math.max(0, 90 - daysSince);

    if (daysSince >= 90) {
      return { 
        status: 'ready', 
        daysStatus: `${daysSince} days since last donation`, 
        canDonate: true,
        daysUntilReady: 0
      };
    } else if (daysSince >= 75) {
      return { 
        status: 'soon', 
        daysStatus: `Available in ${daysUntilReady} days`, 
        canDonate: false,
        daysUntilReady
      };
    } else {
      return { 
        status: 'not-ready', 
        daysStatus: `Available in ${daysUntilReady} days`, 
        canDonate: false,
        daysUntilReady
      };
    }
  };

  const refreshDonors = () => {
    const all = donorStorage.getDonors();
    // For each private owner animal, find its last donation date
    let privateAnimals = all.filter(x => x.isPrivateOwner).map(animal => {
      // Find all donations for this animal (by id or by animalName+ownerName)
      const matches = all.filter(d =>
        d.isPrivateOwner &&
        d.animalName === animal.animalName &&
        d.ownerName === animal.ownerName
      );
      // Get the latest date
      const lastDonation = matches.reduce((latest, d) => {
        if (d.date && (!latest || new Date(d.date) > new Date(latest))) {
          return d.date;
        }
        return latest;
      }, null);
      const donationInfo = calculateDonationStatus(lastDonation);
      return { 
        ...animal, 
        donationDate: lastDonation,
        ...donationInfo
      };
    });

    // Filter by blood type if selected
    if (bloodTypeFilter) {
      privateAnimals = privateAnimals.filter(a => a.bloodType === bloodTypeFilter);
    }

    // Filter by search query (name of animal or owner)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      privateAnimals = privateAnimals.filter(a => 
        (a.animalName || '').toLowerCase().includes(query) ||
        (a.ownerName || '').toLowerCase().includes(query) ||
        (a.ownerPhone || '').toLowerCase().includes(query)
      );
    }

    // Smart sorting: Ready -> Soon -> Not Ready, then by days until ready (ascending)
    const sorted = privateAnimals.sort((a, b) => {
      const statusOrder = { 'ready': 0, 'soon': 1, 'not-ready': 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.status === 'ready' && b.status === 'ready') {
        return b.daysUntilReady - a.daysUntilReady;
      }
      return a.daysUntilReady - b.daysUntilReady;
    });
    setDonors(sorted);
  };

  const handleDelete = (index) => {
    const donorToDelete = donors[index];
    if (!donorToDelete) return;
    
    if (!window.confirm(`❌ Delete this donor?\n\nName: ${donorToDelete.animalName}\nOwner: ${donorToDelete.ownerName}\nType: ${donorToDelete.animalType}\nPhone: ${donorToDelete.ownerPhone || 'N/A'}`)) return;
    
    const all = donorStorage.getDonors();
    const privateOwners = all.filter(x => x.isPrivateOwner);
    const origIdx = all.findIndex(d =>
      d.isPrivateOwner &&
      d.ownerName === donorToDelete.ownerName &&
      d.animalName === donorToDelete.animalName
    );
    if (origIdx !== -1) {
      const updatedAll = [...all];
      updatedAll.splice(origIdx, 1);
      donorStorage.saveDonors(updatedAll);
      refreshDonors();
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return `border-green-500 ${colors.bg.tertiary}`;
      case 'soon': return `border-yellow-500 ${colors.bg.tertiary}`;
      case 'not-ready': return `border-red-500 ${colors.bg.tertiary}`;
      default: return `${colors.border.primary} ${colors.bg.tertiary}`;
    }
  };

  const getStatusTextColor = (status) => {
    // Improve contrast for dark mode
    if (colors.isDarkMode) {
      switch (status) {
        case 'ready': return 'text-green-300';
        case 'soon': return 'text-yellow-200';
        case 'not-ready': return 'text-red-300';
        default: return 'text-gray-100';
      }
    } else {
      switch (status) {
        case 'ready': return 'text-green-700';
        case 'soon': return 'text-yellow-700';
        case 'not-ready': return 'text-red-700';
        default: return colors.text.primary;
      }
    }
  };

  return (
    <div className={`min-h-screen ${colors.bg.primary} p-4`}>
      <div className={`max-w-7xl mx-auto ${colors.bg.card} rounded-2xl shadow-lg p-6 ${colors.border.primary} border`}>
        <div className="text-center mb-8">
          <h1 className={`text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2`}>
            👥 Private Owners
          </h1>
          <div className={`w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full ${colors.isDarkMode ? 'opacity-80' : ''}`}></div>
        </div>
        {/* Filters - Search and Blood Type */}
        <div className="mb-6 flex flex-col gap-3">
          {/* Search Bar */}
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="text-xl flex-shrink-0">🔍</span>
            <input
              type="text"
              placeholder="Search by animal name, owner name, or phone..."
              className={`flex-1 min-w-0 p-3 rounded-lg border ${colors.border.primary} ${colors.bg.input} ${colors.text.primary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="flex-shrink-0 px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Blood Type Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <label className={`font-semibold ${colors.text.primary}`}>Filter by Blood Type:</label>
            <select
              className={`p-2 rounded-lg border ${colors.border.primary} ${colors.bg.input} ${colors.text.primary} w-full sm:w-48`}
              value={bloodTypeFilter}
              onChange={e => setBloodTypeFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="DEA 1.1 Positive">DEA 1.1 Positive (Dog)</option>
              <option value="DEA 1.1 Negative">DEA 1.1 Negative (Dog)</option>
              <option value="A">A (Cat)</option>
              <option value="AB">AB (Cat)</option>
              <option value="B">B (Cat)</option>
            </select>
          </div>
        </div>

        {donors.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🐕</div>
            <h3 className={`text-xl font-semibold ${colors.text.primary} mb-2`}>No Private Owner Animals</h3>
            <p className={`${colors.text.muted} ${colors.isDarkMode ? 'text-gray-400' : ''}`}>Add animals with private owners to see them here</p>
          </div>
        ) : (
          <>
            {/* Ready to Donate - Collapsible */}
            {donors.filter(d => d.status === 'ready').length > 0 && (
              <div className={`${colors.bg.card} rounded-xl shadow-lg ${colors.border.primary} border overflow-hidden mb-4`}>
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  onClick={() => setShowReady(!showReady)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {donors.filter(d => d.status === 'ready').length}
                    </div>
                    <h2 className="text-lg font-bold text-green-600 dark:text-green-400">✅ Ready to Donate</h2>
                  </div>
                  <span className="text-lg text-green-600 dark:text-green-400">{showReady ? '▼' : '▶'}</span>
                </div>
                {showReady && (
                  <div className="p-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {donors.filter(d => d.status === 'ready').map((d, i) => (
                <div
                  key={i}
                  className={`${colors.bg.card} rounded-xl shadow-lg border-l-4 p-6 cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-105 ${getStatusColor(d.status)}`}
                  onClick={() => setShowProfile(d)}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold ${colors.text.primary} mb-1`}>{d.animalName || "Unknown"}</h3>
                      <div className={`text-sm ${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-300' : ''}`}>{d.animalType || "Unknown"} • {d.bloodType || "Unknown"}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusTextColor(d.status)}`}>
                      {d.status === 'ready' ? 'READY' : d.status === 'soon' ? 'SOON' : 'WAITING'}
                    </div>
                  </div>

                  {/* Owner Info */}
                  <div className="space-y-2 mb-4">
                    <div className={`flex items-center text-sm ${colors.text.primary}`}>
                      <span className={`font-medium w-16 ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Owner:</span>
                      <span className={`truncate ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{d.ownerName || "Unknown"}</span>
                    </div>
                    <div className={`flex items-center text-sm ${colors.text.primary}`}>
                      <span className={`font-medium w-16 ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Phone:</span>
                      <span className={`truncate ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{d.ownerPhone || "Unknown"}</span>
                    </div>
                    {d.fileNumber && (
                      <div className={`flex items-center text-sm ${colors.text.primary}`}>
                        <span className={`font-medium w-16 ${colors.isDarkMode ? 'text-gray-300' : ''}`}>File #:</span>
                        <span className={`truncate ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{d.fileNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Donation Status */}
                  <div className="border-t dark:border-gray-700 pt-4">
                    <div className={`text-sm font-medium ${getStatusTextColor(d.status)}`}>
                      {d.daysStatus}
                    </div>
                    {d.donationDate && (
                      <div className={`text-xs ${colors.text.secondary} mt-1`}>
                        Last: {new Date(d.donationDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t dark:border-gray-700" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onEdit(d)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(i)}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Available Soon - Collapsible */}
            {donors.filter(d => d.status === 'soon').length > 0 && (
              <div className={`${colors.bg.card} rounded-xl shadow-lg ${colors.border.primary} border overflow-hidden mb-4`}>
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
                  onClick={() => setShowSoon(!showSoon)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {donors.filter(d => d.status === 'soon').length}
                    </div>
                    <h2 className="text-lg font-bold text-yellow-600 dark:text-yellow-400">⌛ Available Soon</h2>
                  </div>
                  <span className="text-lg text-yellow-600 dark:text-yellow-400">{showSoon ? '▼' : '▶'}</span>
                </div>
                {showSoon && (
                  <div className="p-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {donors.filter(d => d.status === 'soon').map((d, i) => (
                <div
                  key={i}
                  className={`${colors.bg.card} rounded-xl shadow-lg border-l-4 p-6 cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-105 ${getStatusColor(d.status)}`}
                  onClick={() => setShowProfile(d)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold ${colors.text.primary} mb-1`}>{d.animalName || "Unknown"}</h3>
                      <div className={`text-sm ${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-300' : ''}`}>{d.animalType || "Unknown"} • {d.bloodType || "Unknown"}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusTextColor(d.status)}`}>
                      {d.status === 'ready' ? 'READY' : d.status === 'soon' ? 'SOON' : 'WAITING'}
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className={`flex items-center text-sm ${colors.text.primary}`}>
                      <span className={`font-medium w-16 ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Owner:</span>
                      <span className={`truncate ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{d.ownerName || "Unknown"}</span>
                    </div>
                    <div className={`flex items-center text-sm ${colors.text.primary}`}>
                      <span className={`font-medium w-16 ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Phone:</span>
                      <span className={`truncate ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{d.ownerPhone || "Unknown"}</span>
                    </div>
                    {d.fileNumber && (
                      <div className={`flex items-center text-sm ${colors.text.primary}`}>
                        <span className={`font-medium w-16 ${colors.isDarkMode ? 'text-gray-300' : ''}`}>File #:</span>
                        <span className={`truncate ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{d.fileNumber}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t dark:border-gray-700 pt-4">
                    <div className={`text-sm font-medium ${getStatusTextColor(d.status)}`}>
                      {d.daysStatus}
                    </div>
                    {d.donationDate && (
                      <div className={`text-xs ${colors.text.secondary} mt-1`}>
                        Last: {new Date(d.donationDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t dark:border-gray-700" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onEdit(d)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(i)}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Not Ready - Collapsible */}
            {donors.filter(d => d.status === 'not-ready').length > 0 && (
              <div className={`${colors.bg.card} rounded-xl shadow-lg ${colors.border.primary} border overflow-hidden mb-4`}>
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  onClick={() => setShowNotReady(!showNotReady)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {donors.filter(d => d.status === 'not-ready').length}
                    </div>
                    <h2 className="text-lg font-bold text-red-600 dark:text-red-400">⏸️ Not Ready</h2>
                  </div>
                  <span className="text-lg text-red-600 dark:text-red-400">{showNotReady ? '▼' : '▶'}</span>
                </div>
                {showNotReady && (
                  <div className="p-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {donors.filter(d => d.status === 'not-ready').map((d, i) => (
                <div
                  key={i}
                  className={`${colors.bg.card} rounded-xl shadow-lg border-l-4 p-6 cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-105 ${getStatusColor(d.status)}`}
                  onClick={() => setShowProfile(d)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold ${colors.text.primary} mb-1`}>{d.animalName || "Unknown"}</h3>
                      <div className={`text-sm ${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-300' : ''}`}>{d.animalType || "Unknown"} • {d.bloodType || "Unknown"}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusTextColor(d.status)}`}>
                      {d.status === 'ready' ? 'READY' : d.status === 'soon' ? 'SOON' : 'WAITING'}
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className={`flex items-center text-sm ${colors.text.primary}`}>
                      <span className={`font-medium w-16 ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Owner:</span>
                      <span className={`truncate ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{d.ownerName || "Unknown"}</span>
                    </div>
                    <div className={`flex items-center text-sm ${colors.text.primary}`}>
                      <span className={`font-medium w-16 ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Phone:</span>
                      <span className={`truncate ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{d.ownerPhone || "Unknown"}</span>
                    </div>
                    {d.fileNumber && (
                      <div className={`flex items-center text-sm ${colors.text.primary}`}>
                        <span className={`font-medium w-16 ${colors.isDarkMode ? 'text-gray-300' : ''}`}>File #:</span>
                        <span className={`truncate ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{d.fileNumber}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t dark:border-gray-700 pt-4">
                    <div className={`text-sm font-medium ${getStatusTextColor(d.status)}`}>
                      {d.daysStatus}
                    </div>
                    {d.donationDate && (
                      <div className={`text-xs ${colors.text.secondary} mt-1`}>
                        Last: {new Date(d.donationDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t dark:border-gray-700" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onEdit(d)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(i)}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Enhanced Profile Modal */}
      {showProfile && (() => {
        // Get all donor records for this animal (by unique match)
        const allDonors = donorStorage.getDonors();
        const history = allDonors
          .filter(d => d.isPrivateOwner && isSameAnimal(d, showProfile))
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowProfile(null)}>
          <div className={`${colors.bg.card} rounded-2xl shadow-2xl w-full max-w-md mx-auto`} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`p-6 rounded-t-2xl ${getStatusColor(showProfile.status)}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className={`text-2xl font-bold mb-2 ${colors.isDarkMode ? 'text-white' : 'text-gray-900'}`}>{showProfile.animalName}</h3>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusTextColor(showProfile.status)}`}>
                    {showProfile.status === 'ready' ? 'Ready to Donate' : 
                     showProfile.status === 'soon' ? 'Available Soon' : 'Not Ready Yet'}
                  </div>
                </div>
                <button 
                  onClick={() => setShowProfile(null)} 
                  className={`${colors.text.secondary} hover:${colors.text.primary} transition-colors`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Owner Information */}
                <div>
                  <h4 className={`font-semibold ${colors.text.primary} mb-3`}>Owner Information</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Name:</span>
                      <span className={`font-medium ${colors.text.primary} ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{showProfile.ownerName || "Not specified"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Phone:</span>
                      <span className={`font-medium ${colors.text.primary} ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{showProfile.ownerPhone || "Not specified"}</span>
                    </div>
                    {showProfile.fileNumber && (
                      <div className="flex justify-between">
                        <span className={`${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-300' : ''}`}>File Number:</span>
                        <span className={`font-medium ${colors.text.primary} ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{showProfile.fileNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Animal Details */}
                <div className={`border-t ${colors.border.primary} pt-4`}>
                  <h4 className={`font-semibold ${colors.text.primary} mb-3`}>Animal Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Type:</span>
                      <span className={`font-medium ${colors.text.primary} ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{showProfile.animalType || "Not specified"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Blood Type:</span>
                      <span className={`font-medium ${colors.text.primary} ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{showProfile.bloodType || "Not specified"}</span>
                    </div>
                    {showProfile.age && (
                      <div className="flex justify-between">
                        <span className={`${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-300' : ''}`}>Age:</span>
                        <span className={`font-medium ${colors.text.primary} ${colors.isDarkMode ? 'text-gray-100' : ''}`}>{showProfile.age}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Donation/Test History */}
                <div className={`border-t ${colors.border.primary} pt-4`}>
                  <h4 className={`font-semibold ${colors.text.primary} mb-3`}>Donation & Test History</h4>
                  {history.length === 0 ? (
                    <div className={`${colors.text.secondary} ${colors.isDarkMode ? 'text-gray-400' : ''}`}>No donation or test records found.</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {history.map((rec, idx) => (
                        <div key={idx} className={`rounded-lg p-3 ${colors.bg.tertiary} border ${colors.border.primary}` + (colors.isDarkMode ? ' text-gray-100' : '')}>
                          <div className="flex justify-between items-center">
                            <span className={`font-semibold text-sm ${colors.isDarkMode ? 'text-white' : 'text-gray-900'}`}>{rec.date ? new Date(rec.date).toLocaleDateString() : 'No date'}</span>
                            <span className={`text-xs ${colors.isDarkMode ? 'text-white' : 'text-gray-600'}`}>{rec.location || 'Unknown location'}</span>
                          </div>
                          {rec.tests && Array.isArray(rec.tests) && rec.tests.length > 0 && (
                            <div className={`mt-1 text-xs ${colors.isDarkMode ? 'text-gray-200' : ''}`}>
                              <span className="font-semibold">Tests:</span> {rec.tests.map((t, i) => typeof t === 'string' ? t : t.name || '').join(', ')}
                            </div>
                          )}
                          {rec.notes && (
                            <div className={`mt-1 text-xs ${colors.isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{rec.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Donation Status */}
                <div className={`border-t ${colors.border.primary} pt-4`}>
                  <h4 className={`font-semibold ${colors.text.primary} mb-3`}>Donation Status</h4>
                  <div className="space-y-2">
                    <div className={`p-3 rounded-lg ${getStatusColor(showProfile.status)}` + (colors.isDarkMode ? ' text-gray-100' : '')}>
                      <div className={`font-medium ${getStatusTextColor(showProfile.status)}`}>
                        {showProfile.daysStatus}
                      </div>
                      {showProfile.donationDate && (
                        <div className={`text-sm ${colors.text.secondary} mt-1` + (colors.isDarkMode ? ' text-gray-300' : '')}>
                          Last donated: {new Date(showProfile.donationDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {showProfile.notes && (
                  <div className={`border-t ${colors.border.primary} pt-4`}>
                    <h4 className={`font-semibold ${colors.text.primary} mb-3`}>Notes</h4>
                    <div className={`${colors.text.primary} ${colors.bg.tertiary} p-3 rounded-lg` + (colors.isDarkMode ? ' text-gray-100' : '')}>
                      {showProfile.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => {
                  setShowProfile(null);
                  // Prepare new donation object
                  const { date, tests, notes, daysStatus, status, daysUntilReady, donationDate, ...baseAnimal } = showProfile;
                  let cleanAnimal = { ...baseAnimal };
                  const all = donorStorage.getDonors();
                  // 1. Auto-fill blood type from previous donations if missing
                  if (!cleanAnimal.bloodType) {
                    const prev = all.find(d => d.isPrivateOwner && d.animalName === cleanAnimal.animalName && d.ownerName === cleanAnimal.ownerName && d.bloodType);
                    if (prev) {
                      cleanAnimal.bloodType = normalizeBloodType(prev.bloodType, prev.animalType);
                    }
                  } else {
                    // Normalize existing blood type
                    cleanAnimal.bloodType = normalizeBloodType(cleanAnimal.bloodType, cleanAnimal.animalType);
                  }
                  // 2. Age: recalculate based on first donation's age and date
                  const firstDonation = all
                    .filter(d => d.isPrivateOwner && d.animalName === cleanAnimal.animalName && d.ownerName === cleanAnimal.ownerName && d.age && d.date)
                    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                  if (firstDonation) {
                    const firstAge = parseFloat(firstDonation.age);
                    const firstDate = new Date(firstDonation.date);
                    const now = new Date();
                    if (!isNaN(firstAge)) {
                      const diffYears = (now - firstDate) / (1000*60*60*24*365.25);
                      const newAge = (firstAge + diffYears).toFixed(1);
                      cleanAnimal.age = newAge;
                    }
                  }
                  // 3. Weight: always empty
                  cleanAnimal.weight = '';
                  // 4. Donated: always empty
                  cleanAnimal.donated = '';
                  // 5. Date, tests, notes: always empty
                  if (onNewDonation) onNewDonation(cleanAnimal);
                }}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                New Donation
              </button>
              <button
                onClick={() => {
                  setShowProfile(null);
                  onEdit(showProfile);
                }}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                Edit Animal
              </button>
              <button
                onClick={() => setShowProfile(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-all duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default ManualDonorList;
