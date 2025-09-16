
import React, { useState, useEffect } from "react";
import { donorStorage } from '../utils/storage.js';

const ManualDonorList = ({ onEdit }) => {
  const [donors, setDonors] = useState([]);
  const [showProfile, setShowProfile] = useState(null);

  useEffect(() => {
    refreshDonors();
  }, []);

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
    const privateAnimals = all.filter(x => x.isPrivateOwner).map(animal => {
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

    // Smart sorting: Ready -> Soon -> Not Ready, then by days until ready (ascending)
    const sorted = privateAnimals.sort((a, b) => {
      const statusOrder = { 'ready': 0, 'soon': 1, 'not-ready': 2 };
      
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      
      // Within the same status, sort by days until ready (ready animals by days since donation desc)
      if (a.status === 'ready' && b.status === 'ready') {
        return b.daysUntilReady - a.daysUntilReady; // More days since = higher priority
      }
      
      return a.daysUntilReady - b.daysUntilReady;
    });

    setDonors(sorted);
  };

  const handleDelete = (index) => {
    if (!window.confirm("Delete this donor?")) return;
    const all = donorStorage.getDonors();
    const privateOwners = all.filter(x => x.isPrivateOwner);
    const donorToDelete = privateOwners[index];
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
      case 'ready': return 'border-green-500 bg-green-50';
      case 'soon': return 'border-yellow-500 bg-yellow-50';
      case 'not-ready': return 'border-red-500 bg-red-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'ready': return 'text-green-700';
      case 'soon': return 'text-yellow-700';
      case 'not-ready': return 'text-red-700';
      default: return 'text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Private Owners
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full"></div>
        </div>

        {donors.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🐕</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Private Owner Animals</h3>
            <p className="text-gray-500">Add animals with private owners to see them here</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 shadow-lg border border-green-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {donors.filter(d => d.status === 'ready').length}
                  </div>
                  <div className="text-sm text-green-600 font-medium">Ready to Donate</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-lg border border-yellow-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {donors.filter(d => d.status === 'soon').length}
                  </div>
                  <div className="text-sm text-yellow-600 font-medium">Available Soon</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-lg border border-red-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {donors.filter(d => d.status === 'not-ready').length}
                  </div>
                  <div className="text-sm text-red-600 font-medium">Not Ready</div>
                </div>
              </div>
            </div>

            {/* Animal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {donors.map((d, i) => (
                <div
                  key={i}
                  className={`bg-white rounded-xl shadow-lg border-l-4 p-6 cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-105 ${getStatusColor(d.status)}`}
                  onClick={() => setShowProfile(d)}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-1">{d.animalName || "Unknown"}</h3>
                      <div className="text-sm text-gray-600">{d.animalType || "Unknown"} • {d.bloodType || "Unknown"}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusTextColor(d.status)}`}>
                      {d.status === 'ready' ? 'READY' : d.status === 'soon' ? 'SOON' : 'WAITING'}
                    </div>
                  </div>

                  {/* Owner Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-700">
                      <span className="font-medium w-16">Owner:</span>
                      <span className="truncate">{d.ownerName || "Unknown"}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                      <span className="font-medium w-16">Phone:</span>
                      <span className="truncate">{d.ownerPhone || "Unknown"}</span>
                    </div>
                    {d.fileNumber && (
                      <div className="flex items-center text-sm text-gray-700">
                        <span className="font-medium w-16">File #:</span>
                        <span className="truncate">{d.fileNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Donation Status */}
                  <div className="border-t pt-4">
                    <div className={`text-sm font-medium ${getStatusTextColor(d.status)}`}>
                      {d.daysStatus}
                    </div>
                    {d.donationDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        Last: {new Date(d.donationDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t" onClick={e => e.stopPropagation()}>
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
          </>
        )}
      </div>

      {/* Enhanced Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowProfile(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`p-6 rounded-t-2xl ${getStatusColor(showProfile.status)}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">{showProfile.animalName}</h3>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusTextColor(showProfile.status)}`}>
                    {showProfile.status === 'ready' ? 'Ready to Donate' : 
                     showProfile.status === 'soon' ? 'Available Soon' : 'Not Ready Yet'}
                  </div>
                </div>
                <button 
                  onClick={() => setShowProfile(null)} 
                  className="text-gray-500 hover:text-gray-700 transition-colors"
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
                  <h4 className="font-semibold text-gray-800 mb-3">Owner Information</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">{showProfile.ownerName || "Not specified"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium">{showProfile.ownerPhone || "Not specified"}</span>
                    </div>
                    {showProfile.fileNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">File Number:</span>
                        <span className="font-medium">{showProfile.fileNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Animal Details */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Animal Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{showProfile.animalType || "Not specified"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Blood Type:</span>
                      <span className="font-medium">{showProfile.bloodType || "Not specified"}</span>
                    </div>
                    {showProfile.age && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Age:</span>
                        <span className="font-medium">{showProfile.age}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Donation Status */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Donation Status</h4>
                  <div className="space-y-2">
                    <div className={`p-3 rounded-lg ${getStatusColor(showProfile.status)}`}>
                      <div className={`font-medium ${getStatusTextColor(showProfile.status)}`}>
                        {showProfile.daysStatus}
                      </div>
                      {showProfile.donationDate && (
                        <div className="text-sm text-gray-600 mt-1">
                          Last donated: {new Date(showProfile.donationDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {showProfile.notes && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-800 mb-3">Notes</h4>
                    <div className="text-gray-700 bg-gray-50 p-3 rounded-lg">
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
      )}
    </div>
  );
};

export default ManualDonorList;
