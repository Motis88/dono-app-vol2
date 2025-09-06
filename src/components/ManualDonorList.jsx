
import React, { useState, useEffect } from "react";
import { donorStorage } from '../utils/storage.js';

const ManualDonorList = ({ onEdit }) => {
  const [donors, setDonors] = useState([]);
  const [showProfile, setShowProfile] = useState(null);

  useEffect(() => {
    refreshDonors();
  }, []);

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
      return { ...animal, donationDate: lastDonation };
    });
    setDonors(privateAnimals);
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

  return (
    <div className="p-4 max-w-4xl mx-auto text-left">
      <h2 className="text-xl font-bold mb-4 text-center">Owners</h2>
      <table className="w-full text-sm border border-gray-300 text-center">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Animal Name</th>
            <th className="border px-2 py-1">Owner Name</th>
            <th className="border px-2 py-1">File Number</th>
            <th className="border px-2 py-1">Phone Number</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {donors.length === 0 && (
            <tr><td colSpan={6} className="text-gray-500 py-4">No records to show</td></tr>
          )}
          {donors.map((d, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
              style={{ cursor: "pointer" }}
              onClick={() => setShowProfile(d)}
            >
              <td className="border px-2 py-1">{d.animalName || "-"}</td>
              <td className="border px-2 py-1">{d.ownerName || "-"}</td>
              <td className="border px-2 py-1">{d.fileNumber || "-"}</td>
              <td className="border px-2 py-1">{d.ownerPhone || "-"}</td>
              <td className="border px-2 py-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => onEdit(d)} className="text-blue-600 hover:underline mx-2">Edit</button>
                <button onClick={() => handleDelete(i)} className="text-red-600 hover:underline mx-2">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* פרופיל מלא של בע"ח */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setShowProfile(null)}>
          <div className="bg-white p-6 rounded shadow w-[400px] relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowProfile(null)} className="absolute top-2 left-2 text-xl">&times;</button>
            <h3 className="text-lg font-bold mb-2">{showProfile.animalName}</h3>
            <div className="mb-2">Owner Name: {showProfile.ownerName}</div>
            <div className="mb-2">File Number: {showProfile.fileNumber}</div>
            <div className="mb-2">Phone Number: {showProfile.ownerPhone}</div>
            <div className="mb-2">Age: {showProfile.age}</div>
            <div className="mb-2">Type: {showProfile.animalType}</div>
            <div className="mb-2">Blood Type: {showProfile.bloodType}</div>
            <div className="mb-2">Notes: {showProfile.notes}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualDonorList;
