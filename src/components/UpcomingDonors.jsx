import React, { useState, useEffect } from "react";
import { donorStorage } from '../utils/storage.js';

// מחזיר את הרשומה עם date הכי מאוחרת לכל שם+מיקום
function getLatestByNameAndLocation(list) {
  const map = {};
  list.forEach(d => {
    if (!d.animalName || !d.location) return;
    const key = d.animalName + "|" + d.location;
    if (!map[key] || new Date(d.date) > new Date(map[key].date)) {
      map[key] = d;
    }
  });
  return Object.values(map);
}

// האם יש אותיות בשם (ולא רק מספר)
const isNameWithLetters = name => /[A-Za-zא-ת]/.test(name);

const AnimalCard = ({ donor, onClose, onEdit, onMarkDonated }) => {
  if (!donor) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-lg w-full relative">
        <button className="absolute top-2 right-3 text-2xl" onClick={onClose}>×</button>
        <h2 className="text-xl font-bold mb-4">{donor.animalName}</h2>
        <div className="space-y-1 text-right">
          <div><b>סוג:</b> {donor.animalType}</div>
          <div><b>בעלים:</b> {donor.ownerName}</div>
          <div><b>טלפון:</b> {donor.ownerPhone}</div>
          <div><b>מיקום:</b> {donor.location}</div>
          <div><b>גיל:</b> {donor.age}</div>
          <div><b>סוג דם:</b> {donor.bloodType}</div>
          <div><b>תאריך אחרון:</b> {donor.date}</div>
          <div><b>תרומה אפשרית מ:</b> {donor.next}</div>
        </div>
        <div className="flex gap-3 mt-6">
          <a
            href={`https://wa.me/${(donor.ownerPhone||'').replace(/[^0-9]/g, "")}?text=היי%20${donor.ownerName},%20האם%20${donor.animalName}%20יכול/ה%20להגיע%20לתרומת%20דם?`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-500 text-white px-4 py-2 rounded"
          >שלח WhatsApp</a>
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={() => onEdit(donor)}>
            ערוך
          </button>
          <button className="bg-gray-400 text-white px-4 py-2 rounded" onClick={() => onMarkDonated(donor)}>
            סומן כתרם
          </button>
          <button className="bg-gray-300 px-4 py-2 rounded" onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};

const UpcomingDonors = ({ onEdit }) => {
  const [donors, setDonors] = useState([]);
  const [showCard, setShowCard] = useState(false);
  const [activeDonor, setActiveDonor] = useState(null);
  const [locationFilter, setLocationFilter] = useState("");

  useEffect(() => {
    const data = donorStorage.getDonors();
    setDonors(data);
  }, []);

  // 1. מאחדים כל שם+מיקום לרשומה הכי עדכנית
  const latestDonors = getLatestByNameAndLocation(donors);

  // 2. מסננים רק את אלה שה-next שלהם במהלך השבוע הקרוב
  const today = new Date();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);

 // --- יש לוודא ש-latestDonors מוגדר למעלה כמו קודם ---

const today = new Date();

const daysBetween = (dateString) => {
  if (!dateString) return 9999;
  const date = new Date(dateString);
  return Math.floor((today - date) / (1000 * 60 * 60 * 24));
};

const eligibleDonors = latestDonors.filter(d => {
  if (!d.date) return false; // חייב שיהיה date!
  const days = daysBetween(d.date);
  // רוצה בין 90 ל-97 יום (שלושה חודשים עד שלושה חודשים ושבוע)
  return days >= 90 && days <= 97;
}).filter(d =>
  !locationFilter || d.location === locationFilter
);



  // קבל כל הלוקציות שיש בפועל
  const locationsInData = Array.from(new Set(latestDonors.map(d => d.location).filter(Boolean)));

  // פעולה: סמן כתרם (מעדכן date ו-next להיום + 90 יום)
  const handleMarkDonated = (donor) => {
    const updated = donors.map(d =>
      ((d.animalName === donor.animalName) && (d.location === donor.location) && d.date === donor.date)
        ? {
            ...d,
            date: new Date().toISOString().slice(0, 10),
            next: (() => {
              const dt = new Date();
              dt.setDate(dt.getDate() + 90);
              return dt.toISOString().slice(0, 10);
            })()
          }
        : d
    );
    setDonors(updated);
    donorStorage.saveDonors(updated);
    setShowCard(false);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto text-left">
      <h2 className="text-xl font-bold mb-4 text-center">בע"ח שיכולים לתרום עכשיו</h2>
      {/* מיון לפי מיקום */}
      <div className="mb-4 flex gap-3 items-center">
        <span>סנן לפי מיקום:</span>
        <select
          className="border p-2 rounded"
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
        >
          <option value="">הצג הכל</option>
          {locationsInData.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>
      <table className="w-full text-sm border border-gray-300 text-center">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">שם בע"ח</th>
            <th className="border px-2 py-1">סוג</th>
            <th className="border px-2 py-1">בעלים</th>
            <th className="border px-2 py-1">מיקום</th>
            <th className="border px-2 py-1">תאריך אחרון</th>
            <th className="border px-2 py-1">תרומה אפשרית מ</th>
          </tr>
        </thead>
        <tbody>
          {eligibleDonors.length === 0 && (
            <tr>
              <td colSpan={6} className="text-gray-500 py-4">אין בע"ח זמינים</td>
            </tr>
          )}
          {eligibleDonors.map((d, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td
                className="border px-2 py-1 text-blue-700 hover:underline cursor-pointer"
                onClick={() => { setActiveDonor(d); setShowCard(true); }}>
                {d.animalName}
              </td>
              <td className="border px-2 py-1">{d.animalType}</td>
              <td className="border px-2 py-1">{d.ownerName}</td>
              <td className="border px-2 py-1">{d.location}</td>
              <td className="border px-2 py-1">{d.date}</td>
              <td className="border px-2 py-1">{d.next}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* פופאפ */}
      {showCard && (
        <AnimalCard
          donor={activeDonor}
          onClose={() => setShowCard(false)}
          onEdit={(donor) => { setShowCard(false); onEdit(donor); }}
          onMarkDonated={handleMarkDonated}
        />
      )}
    </div>
  );
};

export default UpcomingDonors;
