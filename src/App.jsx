import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useSwipeable } from 'react-swipeable';
import { VIEWS, FILE_NAMES } from './utils/constants.js';
import { donorStorage, safeJsonParse } from './utils/storage.js';
import { normalizeDonors, removeExactDuplicates } from './utils/donorUtils.js';
import { Share } from '@capacitor/share';

// Lazy load components to reduce bundle size
const DonorForm = lazy(() => import('./components/DonorForm'));
const TablesByLocation = lazy(() => import('./components/TablesByLocation'));
const Dashboard = lazy(() => import('./components/DonorDashboard'));
const ManualDonorList = lazy(() => import('./components/ManualDonorList'));

/**
 * Check if target element is inside a horizontally scrollable element
 * @param {Element} target - Target element
 * @returns {boolean} True if inside scrollable element
 */
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
    } catch (error) {
      console.warn('Error checking scrollable element:', error);
    }
    target = target.parentElement;
  }
  return false;
}

const App = () => {
  const [view, setView] = useState('form');
  const [editingDonor, setEditingDonor] = useState(null);

  const currentViewIdx = VIEWS.indexOf(view);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (isInsideHorizontallyScrollableElement(e.event.target)) return;
      if (currentViewIdx < VIEWS.length - 1) setView(VIEWS[currentViewIdx + 1]);
    },
    onSwipedRight: (e) => {
      if (isInsideHorizontallyScrollableElement(e.event.target)) return;
      if (currentViewIdx > 0) setView(VIEWS[currentViewIdx - 1]);
    },
    trackMouse: true,
    delta: 10,
  });

  useEffect(() => {
    // Initialize donors from localStorage with error handling
    const rawDonors = donorStorage.getDonors();
    if (rawDonors.length > 0) {
      const normalized = normalizeDonors(rawDonors);
      const cleaned = removeExactDuplicates(normalized);
      donorStorage.saveDonors(cleaned);
    }

    // Check for editing donor
    const editingDonorData = donorStorage.getEditingDonor();
    if (editingDonorData) {
      setEditingDonor(editingDonorData);
      donorStorage.removeEditingDonor();
      setView('form');
    }
  }, []);

  const backupDonorsToFile = async (showAlert = true) => {
    try {
      const donors = donorStorage.getDonors();
      if (donors.length === 0) {
        if (showAlert) alert("⛔ No data to backup.");
        return;
      }
      const dataString = JSON.stringify(donors);
      try {
        // גיבוי ל-Directory.Data (לא Documents)
        await Filesystem.writeFile({
          path: FILE_NAMES.BACKUP,
          data: dataString,
          directory: Directory.Data,
          encoding: 'utf8',
        });
        if (showAlert) alert(`📦 Backup saved! Total donors: ${donors.length}`);
      } catch (err) {
        // Fallback: שיתוף קובץ אם יש שגיאת הרשאה
        if (err?.message?.includes('EACCES') || err?.message?.includes('Permission denied')) {
          if (showAlert) alert('אין הרשאה לכתיבה ל-Data. משתף קובץ דרך מערכת השיתוף.');
          try {
            await Share.share({
              title: 'Donor Backup',
              text: `Backup file with ${donors.length} donors`,
              url: `data:application/json;base64,${btoa(unescape(encodeURIComponent(dataString)))}`,
              dialogTitle: 'Share Donor Backup File',
            });
          } catch (shareErr) {
            alert('שיתוף הקובץ נכשל: ' + (shareErr?.message || shareErr));
          }
        } else {
          console.error("Backup error:", err);
          if (showAlert) alert("😵 Backup failed.");
        }
      }
    } catch (err) {
      console.error("Backup error:", err);
      if (showAlert) alert("😵 Backup failed.");
    }
  };

  const restoreDonorsFromFile = async () => {
    try {
      let result;
      let triedData = false;
      try {
        result = await Filesystem.readFile({
          path: FILE_NAMES.BACKUP,
          directory: Directory.Documents,
          encoding: 'utf8',
        });
      } catch (errDoc) {
        triedData = true;
        try {
          result = await Filesystem.readFile({
            path: FILE_NAMES.BACKUP,
            directory: Directory.Data,
            encoding: 'utf8',
          });
        } catch (errData) {
          if (errData?.message?.includes('permission') || errDoc?.message?.includes('permission')) {
            alert('❌ Restore failed: Missing storage permissions.');
            return;
          }
          if (errData?.message?.includes('not found') || errDoc?.message?.includes('not found')) {
            alert('❌ Restore failed: Backup file not found in Documents or Data folder.');
            return;
          }
          alert('❌ Restore failed: ' + (errData?.message || errDoc?.message));
          return;
        }
      }
      const parsed = safeJsonParse(result.data, []);
      if (!Array.isArray(parsed)) {
        alert('❌ Restore failed: Invalid backup file format.');
        return;
      }
      const normalized = normalizeDonors(parsed);
      const cleaned = removeExactDuplicates(normalized);
      donorStorage.saveDonors(cleaned);
      alert(`✅ Restore succeeded! Total donors restored: ${cleaned.length}`);
      window.location.reload();
    } catch (err) {
      console.error("Restore error:", err);
      alert("😵 Restore failed: " + (err?.message || err));
    }
  };

  const handleAddDonor = (newDonor) => {
    try {
      const current = donorStorage.getDonors();
      const donorWithId = newDonor.id ? newDonor : normalizeDonors([newDonor])[0];
      const exists = current.find(d => d.id === donorWithId.id);
      const merged = exists
        ? current.map(d => d.id === donorWithId.id ? donorWithId : d)
        : [...current, donorWithId];
      const cleaned = removeExactDuplicates(merged);
      
      donorStorage.saveDonors(cleaned);
      setEditingDonor(null);
      setView("table");
      backupDonorsToFile(false);
    } catch (error) {
      console.error("Error adding donor:", error);
      alert("Error adding donor. Please try again.");
    }
  };

  const handleCancelEdit = () => {
    setEditingDonor(null);
    setView('table');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col">
      {/* Top buttons */}
      <div className="flex justify-center mb-8 gap-6 pt-8 md:pt-6" style={{paddingTop: 'env(safe-area-inset-top,3rem)'}}>
        <button
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-emerald-400"
          onClick={backupDonorsToFile}
        >
          Backup
        </button>
        <button
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-amber-400"
          onClick={async () => {
            if (window.confirm('Are you sure you want to RESTORE from backup? This will overwrite all your current donors!')) {
              await restoreDonorsFromFile();
            }
          }}
        >
          Restore
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6" {...swipeHandlers}>
        <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-3 border-blue-600"></div></div>}>
          {view === 'form' && (
            <div className="bg-gradient-to-br from-white to-blue-50 p-3 rounded-3xl shadow-2xl w-full max-w-7xl mx-auto border border-blue-100 backdrop-blur-sm">
              <div className="bg-white/90 p-8 rounded-2xl shadow-inner w-full">
                <DonorForm 
                  editingDonor={editingDonor} 
                  onCancelEdit={handleCancelEdit} 
                  onAddDonor={handleAddDonor} 
                />
              </div>
            </div>
          )}
          {view === 'table' && <TablesByLocation onEdit={(donor) => { setEditingDonor(donor); setView("form"); }} />}
          {view === 'dashboard' && <Dashboard />}
          {view === 'manual' && <ManualDonorList onEdit={(donor) => { setEditingDonor(donor); setView('form'); }} />}
        </Suspense>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm flex justify-around border-t border-gray-200 shadow-lg z-50"
        style={{
          bottom: '16px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          minHeight: 44,
          height: 44,
        }}
      >
        <button
          className={`flex-1 flex flex-col items-center py-2 transition-all duration-300 rounded-t-xl ${
            view === 'form' 
              ? 'text-blue-600 font-bold bg-gradient-to-t from-blue-50 to-transparent shadow-inner' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setView('form')}
        >
          <span style={{fontSize: 24}}>✍️</span>
          <span style={{fontSize: 12, marginTop: 2}}>Form</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center py-2 transition-all duration-300 rounded-t-xl ${
            view === 'table' 
              ? 'text-blue-600 font-bold bg-gradient-to-t from-blue-50 to-transparent shadow-inner' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setView('table')}
        >
          <span style={{fontSize: 24}}>📊</span>
          <span style={{fontSize: 12, marginTop: 2}}>Table</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center py-2 transition-all duration-300 rounded-t-xl ${
            view === 'dashboard' 
              ? 'text-blue-600 font-bold bg-gradient-to-t from-blue-50 to-transparent shadow-inner border-t-2 border-blue-500' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setView('dashboard')}
        >
          <span style={{fontSize: 24}}>📈</span>
          <span style={{fontSize: 12, marginTop: 2}}>Dashboard</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center py-2 transition-all duration-300 rounded-t-xl ${
            view === 'manual' 
              ? 'text-blue-600 font-bold bg-gradient-to-t from-blue-50 to-transparent shadow-inner' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setView('manual')}
        >
          <span style={{fontSize: 24}}>👥</span>
          <span style={{fontSize: 12, marginTop: 2}}>Owners</span>
        </button>
      </div>
    </div>
  );
};

export default App;
