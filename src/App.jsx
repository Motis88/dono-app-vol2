import React, { useState, useEffect } from 'react';
import DonorForm from './components/DonorForm';
import TablesByLocation from './components/TablesByLocation';
import Dashboard from './components/DonorDashboard';
import ManualDonorList from './components/ManualDonorList';
import { v4 as uuidv4 } from 'uuid';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useSwipeable } from 'react-swipeable';

function isInsideHorizontallyScrollableElement(target) {
  while (target) {
    try {
      const style = window.getComputedStyle(target);
      if (
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        target.scrollWidth > target.clientWidth
      ) {
        return true;
      }
    } catch {}
    target = target.parentElement;
  }
  return false;
}

const isMeaningfulName = (name) => {
  if (!name) return false;
  const hasLetters = /[A-Za-z\u0590-\u05FF]/.test(name);
  const onlyDigits = /^\d+$/.test(name.trim());
  return hasLetters && !onlyDigits;
};

const normalizeDonors = (donors) => {
  return donors.map((donor) => {
    if (donor.id) return donor;
    const { animalType, animalName = "", ownerName = "" } = donor;
    const isCat = animalType?.toLowerCase() === "cat";
    const hasGoodName = isMeaningfulName(animalName);
    if (isCat && !hasGoodName) return { ...donor, id: uuidv4() };
    const baseId = `${animalName.trim().toLowerCase()}_${ownerName.trim().toLowerCase()}`;
    return { ...donor, id: baseId };
  });
};

const removeExactDuplicates = (donors) => {
  const seen = new Set();
  const serialize = (d) => JSON.stringify({
    animalName: d.animalName, date: d.date, location: d.location,
    age: d.age, weight: d.weight, gender: d.gender,
    animalType: d.animalType, bloodType: d.bloodType,
    pcv: d.pcv, hct: d.hct, wbc: d.wbc, plt: d.plt,
    fiv: d.fiv, felv: d.felv, packedCell: d.packedCell,
    slideFindings: d.slideFindings, donated: d.donated,
    volume: d.volume, notes: d.notes,
  });

  return donors.filter(d => {
    const key = serialize(d);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const App = () => {
  const [view, setView] = useState('form');
  const [editingDonor, setEditingDonor] = useState(null);

  const views = ['form', 'table', 'dashboard'];
  const currentViewIdx = views.indexOf(view);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (isInsideHorizontallyScrollableElement(e.event.target)) return;
      if (currentViewIdx < views.length - 1) setView(views[currentViewIdx + 1]);
    },
    onSwipedRight: (e) => {
      if (isInsideHorizontallyScrollableElement(e.event.target)) return;
      if (currentViewIdx > 0) setView(views[currentViewIdx - 1]);
    },
    trackMouse: true,
    delta: 10,
  });

  useEffect(() => {
    const raw = localStorage.getItem("animal_donors");
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeDonors(parsed);
      const cleaned = removeExactDuplicates(normalized);
      localStorage.setItem("animal_donors", JSON.stringify(cleaned));
    }
    const stored = localStorage.getItem("editing_donor");
    if (stored) {
      setEditingDonor(JSON.parse(stored));
      localStorage.removeItem("editing_donor");
      setView('form');
    }
  }, []);

  const backupDonorsToFile = async (showAlert = true) => {
    try {
      const data = localStorage.getItem("animal_donors");
      if (!data) {
        if (showAlert) alert("⛔ No data to backup.");
        return;
      }
      await Filesystem.writeFile({
        path: 'donor_backup.json',
        data,
        directory: Directory.Documents,
        encoding: 'utf8',
      });
      if (showAlert) alert("📦 Backup saved in Documents folder!");
    } catch (err) {
      console.error("Backup error:", err);
      if (showAlert) alert("😵 Backup failed.");
    }
  };

  const restoreDonorsFromFile = async () => {
    try {
      const result = await Filesystem.readFile({
        path: 'donor_backup.json',
        directory: Directory.Documents,
        encoding: 'utf8',
      });
      const parsed = JSON.parse(result.data);
      const normalized = normalizeDonors(parsed);
      const cleaned = removeExactDuplicates(normalized);
      localStorage.setItem("animal_donors", JSON.stringify(cleaned));
      window.location.reload();
    } catch (err) {
      console.error("Restore error:", err);
      alert("😵 Restore failed.");
    }
  };

  const handleAddDonor = (newDonor) => {
    const current = JSON.parse(localStorage.getItem("animal_donors") || "[]");
    const donorWithId = newDonor.id ? newDonor : normalizeDonors([newDonor])[0];
    const exists = current.find(d => d.id === donorWithId.id);
    const merged = exists
      ? current.map(d => d.id === donorWithId.id ? donorWithId : d)
      : [...current, donorWithId];
    const cleaned = removeExactDuplicates(merged);
    localStorage.setItem("animal_donors", JSON.stringify(cleaned));
    setEditingDonor(null);
    setView("table");
    backupDonorsToFile(false);
  };

  const handleCancelEdit = () => {
    setEditingDonor(null);
    setView('table');
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Top buttons */}
      <div className="flex justify-center mb-6 gap-4 pt-7 md:pt-4" style={{paddingTop: 'env(safe-area-inset-top,2.7rem)'}}>
        <button
          className="px-4 py-2 rounded bg-green-500 text-white font-bold shadow"
          onClick={backupDonorsToFile}
        >
          Backup
        </button>
        <button
          className="px-4 py-2 rounded bg-yellow-500 text-gray-800 font-bold shadow"
          onClick={async () => {
            if (window.confirm('Are you sure you want to RESTORE from backup? This will overwrite all your current donors!')) {
              await restoreDonorsFromFile();
            }
          }}
        >
          Restore
        </button>
      </div>

      <div className="p-4 pb-4" {...swipeHandlers}>
        {view === 'form' && <DonorForm editingDonor={editingDonor} onCancelEdit={handleCancelEdit} onAddDonor={handleAddDonor} />}
        {view === 'table' && <TablesByLocation onEdit={(donor) => { setEditingDonor(donor); setView("form"); }} />}
        {view === 'dashboard' && <Dashboard />}
        {view === 'manual' && <ManualDonorList />}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 bg-white flex justify-around border-t shadow z-50"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 9px)',
          minHeight: 58,
        }}
      >
        <button
          className={`flex-1 flex flex-col items-center py-1 ${view === 'form' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          onClick={() => setView('form')}
        >
          <span style={{fontSize: 22}}>📝</span>
          <span style={{fontSize: 13, marginTop: 2}}>Form</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center py-1 ${view === 'table' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          onClick={() => setView('table')}
        >
          <span style={{fontSize: 22}}>📋</span>
          <span style={{fontSize: 13, marginTop: 2}}>Table</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center py-1 ${view === 'dashboard' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          onClick={() => setView('dashboard')}
        >
          <span style={{fontSize: 22}}>📊</span>
          <span style={{fontSize: 13, marginTop: 2}}>Dashboard</span>
        </button>
      </div>
    </div>
  );
};

export default App;
