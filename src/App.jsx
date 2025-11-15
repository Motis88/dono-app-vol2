import React, { useState, useEffect, Suspense, lazy } from 'react';
import { FiMenu } from 'react-icons/fi';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { VIEWS, FILE_NAMES } from './utils/constants.js';
import { donorStorage, safeJsonParse } from './utils/storage.js';
import { normalizeDonors, removeExactDuplicates } from './utils/donorUtils.js';
import { Share } from '@capacitor/share';
import { ThemeProvider, useTheme } from './contexts/ThemeContext.jsx';
import { useSwipeable } from 'react-swipeable';
import toast, { Toaster } from 'react-hot-toast';
import { scheduleAutoBackup, isBackupDue, getBackupStats } from './utils/autoBackupUtils.js';

// Lazy load components to reduce bundle size
const DonorForm = lazy(() => import('./components/DonorForm'));
const TablesByLocation = lazy(() => import('./components/TablesByLocation'));
const Dashboard = lazy(() => import('./components/DonorDashboard'));
const ManualDonorList = lazy(() => import('./components/ManualDonorList'));
const InventoryManager = lazy(() => import('./components/InventoryManager'));
const FinancialTracker = lazy(() => import('./components/FinancialTracker'));
const CloudBackupManager = lazy(() => import('./components/CloudBackupManager'));

const AppContent = () => {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [view, setView] = useState('form');
  const [editingDonor, setEditingDonor] = useState(null);
  const [locationFilter, setLocationFilter] = useState(null); // For dashboard -> table navigation
  const [monthFilter, setMonthFilter] = useState(null); // For filtering by specific month

  // Define view order for swipe navigation
  const viewOrder = ['form', 'table', 'dashboard', 'manual', 'inventory', 'financial', 'cloud-backup'];

  // Swipe handlers - only block in tables and inputs
  const handleSwipeLeft = (eventData) => {
    console.log('🔄 Swipe LEFT detected');
    const target = eventData.event?.target;
    if (target) {
      // Only block if DIRECTLY inside:
      // - A table element
      // - An input field
      // - An element explicitly marked as no-swipe
      const inTable = target.closest('table');
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      const inNoSwipe = target.closest('[data-no-swipe]');
      
      if (inTable || inInput || inNoSwipe) {
        console.log('❌ Swipe blocked:', { inTable: !!inTable, inInput, inNoSwipe: !!inNoSwipe });
        return;
      }
    }
    
    console.log('✅ Swipe LEFT executed');
    const currentIndex = viewOrder.indexOf(view);
    const nextIndex = (currentIndex + 1) % viewOrder.length;
    setView(viewOrder[nextIndex]);
  };

  const handleSwipeRight = (eventData) => {
    console.log('🔄 Swipe RIGHT detected');
    const target = eventData.event?.target;
    if (target) {
      // Only block if DIRECTLY inside:
      // - A table element
      // - An input field
      // - An element explicitly marked as no-swipe
      const inTable = target.closest('table');
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      const inNoSwipe = target.closest('[data-no-swipe]');
      
      if (inTable || inInput || inNoSwipe) {
        console.log('❌ Swipe blocked:', { inTable: !!inTable, inInput, inNoSwipe: !!inNoSwipe });
        return;
      }
    }
    
    console.log('✅ Swipe RIGHT executed');
    const currentIndex = viewOrder.indexOf(view);
    const prevIndex = (currentIndex - 1 + viewOrder.length) % viewOrder.length;
    setView(viewOrder[prevIndex]);
  };

  // Configure swipeable handlers with proper settings
  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight,
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
    delta: 80, // Increased threshold to be more intentional
    swipeDuration: 500,
    touchEventOptions: { passive: true },
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

    // Check for auto cloud backup
    const checkAutoBackup = async () => {
      const { isCloudBackupDue, performAutoBackup } = await import('./utils/cloudBackupUtils.js');
      
      if (isCloudBackupDue()) {
        toast.loading('Performing automatic cloud backup...', { id: 'auto-backup' });
        
        const result = await performAutoBackup();
        
        if (result.success) {
          toast.success('☁️ Automatic backup completed!', { id: 'auto-backup', duration: 3000 });
        } else if (result.reason !== 'Backup not due yet' && result.reason !== 'Not enabled or not authenticated') {
          toast.error(`❌ Auto-backup failed: ${result.error || result.reason}`, { id: 'auto-backup' });
        } else {
          toast.dismiss('auto-backup');
        }
      }
    };
    
    checkAutoBackup();

    // Check for backup reminder (once a week)
    const checkBackupReminder = () => {
      const lastBackup = localStorage.getItem('last_backup_time');
      const lastReminderDismissed = localStorage.getItem('backup_reminder_dismissed');
      
      if (!lastBackup) {
        // No backup ever made - show reminder
        showBackupReminder();
        return;
      }

      const backupDate = new Date(lastBackup);
      const now = new Date();
      const daysSince = Math.floor((now - backupDate) / (1000 * 60 * 60 * 24));
      
      // Check if reminder was dismissed today
      if (lastReminderDismissed) {
        const dismissDate = new Date(lastReminderDismissed);
        const daysSinceDismiss = Math.floor((now - dismissDate) / (1000 * 60 * 60 * 24));
        if (daysSinceDismiss < 1) {
          // Reminder was dismissed today, don't show again
          return;
        }
      }

      // Show reminder if 7+ days since last backup
      if (daysSince >= 7) {
        showBackupReminder();
      }
    };

    const showBackupReminder = () => {
      const lastBackup = localStorage.getItem('last_backup_time');
      const daysSince = lastBackup 
        ? Math.floor((new Date() - new Date(lastBackup)) / (1000 * 60 * 60 * 24))
        : null;
      
      const message = daysSince 
        ? `⚠️ Backup Reminder\n\nLast backup was ${daysSince} days ago.\nIt's recommended to backup your data regularly.\n\nWould you like to backup now?`
        : `⚠️ Backup Reminder\n\nNo backup found.\nIt's recommended to backup your data regularly.\n\nWould you like to backup now?`;
      
      if (window.confirm(message)) {
        backupDonorsToFile();
      } else {
        // User dismissed - don't show again today
        localStorage.setItem('backup_reminder_dismissed', new Date().toISOString());
      }
    };

    // Run backup check after a small delay to not block UI
    const timer = setTimeout(checkBackupReminder, 2000);
    
    // Setup auto-backup scheduling
    const cleanupAutoBackup = scheduleAutoBackup(backupDonorsToFile);
    
    return () => {
      clearTimeout(timer);
      cleanupAutoBackup();
    };
  }, []);

  const backupDonorsToFile = async (showAlert = true) => {
    try {
      const donors = donorStorage.getDonors();
      if (donors.length === 0) {
        if (showAlert) toast.error("No data to backup", { icon: '⛔' });
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
        
        // Save backup timestamp
        localStorage.setItem('last_backup_time', new Date().toISOString());
        
        if (showAlert) toast.success(`Backup saved successfully!\nTotal donors: ${donors.length}`, { icon: '📦', duration: 4000 });
      } catch (err) {
        // Fallback: שיתוף קובץ אם יש שגיאת הרשאה
        if (err?.message?.includes('EACCES') || err?.message?.includes('Permission denied')) {
          if (showAlert) toast('No permission to write to Data folder. Attempting to share file...', { icon: '⚠️', duration: 3000 });
          try {
            await Share.share({
              title: 'Donor Backup',
              text: `Backup file with ${donors.length} donors`,
              url: `data:application/json;base64,${btoa(unescape(encodeURIComponent(dataString)))}`,
              dialogTitle: 'Share Donor Backup File',
            });
          } catch (shareErr) {
            toast.error('File share failed: ' + (shareErr?.message || shareErr));
          }
        } else {
          console.error("Backup error:", err);
          if (showAlert) toast.error("Backup failed", { icon: '😵' });
        }
      }
    } catch (err) {
      console.error("Backup error:", err);
      if (showAlert) toast.error("Backup failed", { icon: '😵' });
    }
  };

  const restoreDonorsFromFile = async () => {
    const loadingToast = toast.loading('Restoring backup...');
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
          toast.dismiss(loadingToast);
          if (errData?.message?.includes('permission') || errDoc?.message?.includes('permission')) {
            toast.error('Restore failed: Missing storage permissions');
            return;
          }
          if (errData?.message?.includes('not found') || errDoc?.message?.includes('not found')) {
            toast.error('Restore failed: Backup file not found');
            return;
          }
          toast.error('Restore failed: ' + (errData?.message || errDoc?.message));
          return;
        }
      }
      const parsed = safeJsonParse(result.data, []);
      if (!Array.isArray(parsed)) {
        toast.dismiss(loadingToast);
        toast.error('Restore failed: Invalid backup file format');
        return;
      }
      const normalized = normalizeDonors(parsed);
      const cleaned = removeExactDuplicates(normalized);
      donorStorage.saveDonors(cleaned);
      toast.dismiss(loadingToast);
      toast.success(`Restore successful!\nTotal donors: ${cleaned.length}`, { duration: 3000 });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error("Restore error:", err);
      toast.dismiss(loadingToast);
      toast.error("Restore failed: " + (err?.message || err));
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
      
      // Calculate and add blood products to inventory if donated
      const bloodProducts = donorStorage.calculateBloodProducts(donorWithId);
      if (Object.keys(bloodProducts).length > 0) {
        const success = donorStorage.addToInventory(bloodProducts);
        if (success) {
          const productNames = Object.keys(bloodProducts).map(key => {
            if (key.includes('מלא')) return 'דם מלא חתול';
            if (key.includes('תרכיז') && key.includes('חתול')) return 'תרכיז תאים חתול';
            if (key.includes('תרכיז') && key.includes('כלב')) return 'תרכיז תאים כלב';
            if (key.includes('פלסמה') && key.includes('חתול')) return 'פלסמה חתול';
            if (key.includes('פלסמה') && key.includes('כלב')) return 'פלסמה כלב';
            return key;
          }).join(' + ');
          
          const totalQuantity = Object.values(bloodProducts).reduce((sum, qty) => sum + qty, 0);
          
          // Show success toast with inventory update
          toast.success(`Donor added successfully!\n\n🩸 Blood products added: ${productNames}\n📦 Total units: ${totalQuantity}`, {
            duration: 5000,
            position: 'top-center',
            icon: '✅',
          });
        }
      }
      
      setEditingDonor(null);
      setView("table");
      backupDonorsToFile(false);
    } catch (error) {
      console.error("Error adding donor:", error);
      toast.error("Error adding donor. Please try again.");
    }
  };

  const handleCancelEdit = () => {
    setEditingDonor(null);
    setView('table');
  };

  // Handle location click from dashboard
  const handleLocationClick = (location, month = null) => {
    setLocationFilter(location);
    setMonthFilter(month);
    setView('table');
  };

  return (
    <div className={`min-h-screen ${colors.bg.primary} flex flex-col`}>
      {/* Toast Notifications Container */}
      <Toaster 
        position="top-center"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          // Default options
          duration: 4000,
          style: {
            background: isDarkMode ? '#1f2937' : '#fff',
            color: isDarkMode ? '#f3f4f6' : '#1f2937',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
          // Success toast style
          success: {
            duration: 5000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          // Error toast style
          error: {
            duration: 6000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
          // Loading toast style
          loading: {
            iconTheme: {
              primary: '#3b82f6',
              secondary: '#fff',
            },
          },
        }}
      />
      {/* Modern Top Navigation Bar */}
      <div style={{marginTop: '40px'}}></div>
      <nav className={`w-full z-30 shadow-md ${colors.bg.card} border-b ${colors.border.primary}`} style={{position:'sticky',top:0}}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-3 py-1.5 min-h-[44px]">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent select-none">Dono App</span>
            <div className="hidden md:flex gap-1 ml-4">
              <button onClick={(e)=>{setView('form'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-lg ${view==='form'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Add Donor Form">📝</button>
              <button onClick={(e)=>{setView('table'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-lg ${view==='table'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Donors Table">📋</button>
              <button onClick={(e)=>{setView('dashboard'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-lg ${view==='dashboard'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Dashboard & Statistics">📊</button>
              <button onClick={(e)=>{setView('manual'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-lg ${view==='manual'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Private Owners">👥</button>
              <button onClick={(e)=>{setView('inventory'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-lg ${view==='inventory'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Inventory Management">📦</button>
              <button onClick={(e)=>{setView('financial'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-lg ${view==='financial'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Financial Tracker">💰</button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={()=>setShowMenu(v=>!v)} className="p-1.5 rounded-full hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <FiMenu size={22} className={colors.text.primary} />
            </button>
            {/* Popup menu with backdrop */}
            {showMenu && (
              <>
                {/* Backdrop - closes menu on click */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)}
                />
                {/* Menu */}
                <div className={`absolute right-4 top-12 bg-white dark:bg-gray-900 border ${colors.border.primary} rounded-xl shadow-xl p-2 flex flex-col gap-1 z-50 min-w-[160px]`}>
                  {/* Last Backup Indicator */}
                  {(() => {
                    const lastBackup = localStorage.getItem('last_backup_time');
                    if (lastBackup) {
                      const backupDate = new Date(lastBackup);
                      const now = new Date();
                      const daysSince = Math.floor((now - backupDate) / (1000 * 60 * 60 * 24));
                      const isOld = daysSince > 7;
                      return (
                        <div className={`text-xs px-2 py-1 rounded ${isOld ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                          Last backup: {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
                          {isOld && ' ⚠️'}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <button
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow hover:from-emerald-600 hover:to-emerald-700 border border-emerald-400"
                    onClick={()=>{backupDonorsToFile();setShowMenu(false);}}
                  >Backup</button>
                  <button
                    className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow hover:from-amber-600 hover:to-amber-700 border border-amber-400"
                    onClick={async()=>{if(window.confirm('Are you sure you want to RESTORE from backup? This will overwrite all your current donors!')){await restoreDonorsFromFile();} setShowMenu(false);}}
                  >Restore</button>
                  <button
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg shadow border ${isDarkMode ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-yellow-400' : 'bg-gradient-to-r from-slate-600 to-slate-700 text-white border-slate-500'}`}
                    onClick={()=>{toggleTheme();setShowMenu(false);}}
                  >{isDarkMode ? '☀️ Light' : '🌙 Dark'}</button>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Mobile nav */}
        <div className="flex md:hidden justify-center gap-2 pb-1 overflow-x-auto">
          <button onClick={(e)=>{setView('form'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-xl ${view==='form'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Form">📝</button>
          <button onClick={(e)=>{setView('table'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-xl ${view==='table'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Table">📋</button>
          <button onClick={(e)=>{setView('dashboard'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-xl ${view==='dashboard'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Stats">📊</button>
          <button onClick={(e)=>{setView('manual'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-xl ${view==='manual'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Owners">👥</button>
          <button onClick={(e)=>{setView('inventory'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-xl ${view==='inventory'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Inventory">📦</button>
          <button onClick={(e)=>{setView('financial'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-xl ${view==='financial'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Financial">💰</button>
          <button onClick={(e)=>{setView('cloud-backup'); e.currentTarget.blur();}} className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 text-xl ${view==='cloud-backup'? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50'}`} title="Cloud Backup">☁️</button>
        </div>
      </nav>
      <div {...swipeHandlers} className="flex-1 overflow-y-auto px-3 pb-2 pt-1" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-3 border-blue-600"></div></div>}>
          {view === 'form' && (
            <DonorForm 
                  editingDonor={editingDonor} 
                  onCancelEdit={handleCancelEdit} 
                  onAddDonor={handleAddDonor} 
                />
          )}
          {view === 'table' && (
            <TablesByLocation 
                onEdit={(donor) => { setEditingDonor(donor); setView('form'); }} 
                locationFilter={locationFilter}
                monthFilter={monthFilter}
                onClearFilter={() => {
                  setLocationFilter(null);
                  setMonthFilter(null);
                }}
              />
          )}
          {view === 'dashboard' && (
            <Dashboard onLocationClick={handleLocationClick} />
          )}
          {view === 'manual' && (
            <ManualDonorList 
                onEdit={(donor) => { setEditingDonor(donor); setView('form'); }}
                onNewDonation={(donor) => {
                  setEditingDonor({ ...donor, date: '', tests: [], notes: '' });
                  setView('form');
                }}
              />
          )}
          {view === 'inventory' && (
            <InventoryManager />
          )}
          {view === 'financial' && (
            <FinancialTracker />
          )}
          {view === 'cloud-backup' && (
            <CloudBackupManager />
          )}
        </Suspense>
      </div>

      {/* Removed bottom tab navigation for a cleaner UI */}
    </div>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
