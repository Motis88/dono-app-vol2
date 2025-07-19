import React, { useState, useEffect } from "react";

const ManualDonorList = () => {
  const [donors, setDonors] = useState([]);
  const [editIdx, setEditIdx] = useState(null);
  const [editData, setEditData] = useState(null);
  const [showProfile, setShowProfile] = useState(null);

  useEffect(() => {
    refreshDonors();
  }, []);

  const refreshDonors = () => {
    const all = JSON.parse(localStorage.getItem("animal_donors") || "[]");
    setDonors(all.filter(x => x.isPrivateOwner));
  };

  const handleDelete = (index) => {
    if (!window.confirm("Delete this donor?")) return;
    const all = JSON.parse(localStorage.getItem("animal_donors") || "[]");
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
      localStorage.setItem("animal_donors", JSON.stringify(updatedAll));
      refreshDonors();
    }
  };

  const handleEdit = (index) => {
    setEditIdx(index);
    setEditData({ ...donors[index] });
  };

  const saveEdit = () => {
    const all = JSON.parse(localStorage.getItem("animal_donors") || "[]");
    const privateOwners = all.filter(x => x.isPrivateOwner);
    const origIdx = all.findIndex(d =>
      d.isPrivateOwner &&
      d.ownerName === donors[editIdx].ownerName &&
      d.animalName === donors[editIdx].animalName
    );
    if (origIdx !== -1) {
      all[origIdx] = { ...all[origIdx], ...editData };
      localStorage.setItem("animal_donors", JSON.stringify(all));
      setEditIdx(null);
      setEditData(null);
      refreshDonors();
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto text-left">
      <h2 className="text-xl font-bold mb-4 text-center">Private owners</h2>
      <table className="w-full text-sm border border-gray-300 text-center">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">שם בעלים</th>
            <th className="border px-2 py-1">שם בע״ח</th>
            <th className="border px-2 py-1">טלפון</th>
            <th className="border px-2 py-1">עריכה</th>
          </tr>
        </thead>
        <tbody>
          {donors.length === 0 && (
            <tr><td colSpan={4} className="text-gray-500 py-4">אין רשומות להציג</td></tr>
          )}
          {donors.map((d, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="border px-2 py-1">{d.ownerName || "-"}</td>
              <td
                className="border px-2 py-1 cursor-pointer text-blue-600 underline"
                onClick={() => setShowProfile(d)}
                style={{ direction: "rtl" }}
                title="פתח כרטיס"
              >
                {d.animalName}
              </td>
              <td className="border px-2 py-1">{d.ownerPhone || "-"}</td>
              <td className="border px-2 py-1">
                <button onClick={() => handleEdit(i)} className="text-blue-600 hover:underline mx-2">ערוך</button>
                <button onClick={() => handleDelete(i)} className="text-red-600 hover:underline mx-2">מחק</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* טופס עריכה קופץ */}
      {editIdx !== null && editData && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-96">
            <h3 className="text-lg font-bold mb-4">עריכת בעלים</h3>
            <input
              placeholder="שם בעלים"
              value={editData.ownerName || ""}
              onChange={e => setEditData(ed => ({ ...ed, ownerName: e.target.value }))}
              className="mb-2 w-full p-2 border rounded"
            />
            <input
              placeholder="טלפון"
              value={editData.ownerPhone || ""}
              onChange={e => setEditData(ed => ({ ...ed, ownerPhone: e.target.value }))}
              className="mb-2 w-full p-2 border rounded"
            />
            <input
              placeholder='שם בע"ח'
              value={editData.animalName || ""}
              onChange={e => setEditData(ed => ({ ...ed, animalName: e.target.value }))}
              className="mb-2 w-full p-2 border rounded"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={saveEdit} className="bg-green-600 text-white px-4 py-2 rounded">שמור</button>
              <button onClick={() => { setEditIdx(null); setEditData(null); }} className="bg-gray-400 text-black px-4 py-2 rounded">בטל</button>
            </div>
          </div>
        </div>
      )}

      {/* פרופיל מלא של בע"ח */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setShowProfile(null)}>
          <div className="bg-white p-6 rounded shadow w-[400px] relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowProfile(null)} className="absolute top-2 left-2 text-xl">&times;</button>
            <h3 className="text-lg font-bold mb-2">{showProfile.animalName}</h3>
            <div className="mb-2">שם בעלים: {showProfile.ownerName}</div>
            <div className="mb-2">טלפון: {showProfile.ownerPhone}</div>
            <div className="mb-2">גיל: {showProfile.age}</div>
            <div className="mb-2">סוג: {showProfile.animalType}</div>
            <div className="mb-2">סוג דם: {showProfile.bloodType}</div>
            <div className="mb-2">הערות: {showProfile.notes}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualDonorList;
