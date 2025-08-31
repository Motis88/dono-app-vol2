import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useSwipeable } from 'react-swipeable';
import { VIEWS, FILE_NAMES } from './utils/constants.js';
import { donorStorage, safeJsonParse } from './utils/storage.js';
import { normalizeDonors, removeExactDuplicates } from './utils/donorUtils.js';

// Lazy load components to reduce bundle size
const DonorForm = lazy(() => import('./components/DonorForm'));
const TablesByLocation = lazy(() => import('./components/TablesByLocation'));
const Dashboard = lazy(() => import('./components/DonorDashboard'));
const ManualDonorList = lazy(() => import('./components/ManualDonorList'));
const ExternalCells = lazy(() => import('./components/ExternalCells'));

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
  const MAX_BACKUP_SIZE = 1024 * 1024; // 1MB
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
      if (dataString.length > MAX_BACKUP_SIZE) {
        alert("⚠️ Backup file is too large to share (over 1MB). Please export fewer donors or split the backup.");
        return;
      }
      await Filesystem.writeFile({
        path: FILE_NAMES.BACKUP,
        data: dataString,
        directory: Directory.Data,
        encoding: 'utf8',
      });
      if (showAlert) alert("📦 Backup saved in app's internal storage!");
    } catch (err) {
      console.error("Backup error:", err);
      if (showAlert) {
        if (err?.message?.includes('permission') || err?.message?.includes('denied')) {
          alert("😵 Backup failed due to missing storage permissions. Please check app permissions.");
        } else {
          alert("😵 Backup failed.");
        }
      }
    }
  // שיתוף קובץ הגיבוי מה-Documents
  const shareBackupFile = async () => {
    try {
      const fileUriResult = await Filesystem.getUri({
        path: FILE_NAMES.BACKUP,
        directory: Directory.Documents,
      });
      await Share.share({
        title: 'גיבוי תורמים',
        url: fileUriResult.uri,
        dialogTitle: 'שיתוף גיבוי',
      });
    } catch (error) {
      console.error('שגיאה בשיתוף הגיבוי:', error);
      alert('❌ שיתוף קובץ הגיבוי נכשל.\n\n' + error?.message);
    }
  };
  };

  const restoreDonorsFromFile = async () => {
    try {
      const result = await Filesystem.readFile({
        path: FILE_NAMES.BACKUP,
        directory: Directory.Documents,
        encoding: 'utf8',
      });
      
      const parsed = safeJsonParse(result.data, []);
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid backup file format');
      }
      
      const normalized = normalizeDonors(parsed);
      const cleaned = removeExactDuplicates(normalized);
      donorStorage.saveDonors(cleaned);
      window.location.reload();
    } catch (err) {
      console.error("Restore error:", err);
      alert("😵 Restore failed.");
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
    <div className="min-h-screen pb-16 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      {/* Backup/Restore buttons - top bar */}
      <div
        className="fixed top-0 left-0 right-0 flex flex-wrap justify-center items-center mb-2 gap-2 w-full z-50"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
          minHeight: 34,
          maxWidth: '100vw',
          overflowX: 'auto',
        }}
      >
        <button
          className="px-3 py-1 rounded bg-green-500 text-white font-bold shadow min-w-[90px] max-w-full h-10"
          style={{
            whiteSpace: 'nowrap',
          }}
          onClick={backupDonorsToFile}
        >
          Backup
        </button>
        <button
          className="px-3 py-1 rounded bg-yellow-500 text-gray-800 font-bold shadow min-w-[90px] max-w-full h-10"
          style={{
            whiteSpace: 'nowrap',
          }}
          onClick={async () => {
            if (window.confirm('Are you sure you want to RESTORE from backup? This will overwrite all your current donors!')) {
              await restoreDonorsFromFile();
            }
          }}
        >
          Restore
        </button>
      </div>

      {/* Main content - add top padding for nav bar */}
      <div className="p-4 pb-4 pt-16" {...swipeHandlers}>
        <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
          {view === 'form' && <DonorForm editingDonor={editingDonor} onCancelEdit={handleCancelEdit} onAddDonor={handleAddDonor} />}
          {view === 'table' && <TablesByLocation onEdit={(donor) => { setEditingDonor(donor); setView("form"); }} />}
          {view === 'dashboard' && <Dashboard />}
          {view === 'manual' && <ManualDonorList />}
          {view === 'external-cells' && <ExternalCells />}
        </Suspense>
      </div>

      {/* Navigation buttons - bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white flex justify-around border-b shadow z-50"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 44px)',
          minHeight: 44,
          maxWidth: '100vw',
          overflowX: 'auto',
        }}
      >
        <button
          className={`flex-1 flex flex-col items-center py-1 h-10 ${view === 'form' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          onClick={() => setView('form')}
        >
          <span style={{fontSize: 18}}>📝</span>
          <span style={{fontSize: 11, marginTop: 1}}>Form</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center py-1 h-10 ${view === 'table' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          onClick={() => setView('table')}
        >
          <span style={{fontSize: 18}}>📋</span>
          <span style={{fontSize: 11, marginTop: 1}}>Table</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center py-1 h-10 ${view === 'dashboard' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          onClick={() => setView('dashboard')}
        >
          <span style={{fontSize: 18}}>📊</span>
          <span style={{fontSize: 11, marginTop: 1}}>Dashboard</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center py-1 h-10 ${view === 'external-cells' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          onClick={() => setView('external-cells')}
        >
          <span style={{fontSize: 18}}>🩸</span>
          <span style={{fontSize: 11, marginTop: 1}}>External</span>
        </button>
      </div>
    </div>
  );
};

export default App;
