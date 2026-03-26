import React, { useState, lazy, Suspense } from 'react';
import { CigaretteProvider, useCigarette } from '../../context/CigaretteContext.jsx';

const CigaretteHome = lazy(() => import('./CigaretteHome.jsx'));
const CigaretteStats = lazy(() => import('./CigaretteStats.jsx'));
const PurchaseTracking = lazy(() => import('./PurchaseTracking.jsx'));
const CigaretteInsights = lazy(() => import('./CigaretteInsights.jsx'));
const CigaretteSettings = lazy(() => import('./CigaretteSettings.jsx'));

const TABS = [
  { id: 'home', label: 'בית', icon: '🚬' },
  { id: 'stats', label: 'סטטיסטיקות', icon: '📊' },
  { id: 'purchases', label: 'רכישות', icon: '🛒' },
  { id: 'insights', label: 'תובנות', icon: '💡' },
  { id: 'settings', label: 'הגדרות', icon: '⚙️' },
];

function CigaretteAppInner() {
  const [tab, setTab] = useState('home');
  const { getTodayCount } = useCigarette();
  const todayCount = getTodayCount();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div
        className="bg-orange-500 text-white px-4 pt-4 pb-3 flex items-center justify-between shadow"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <h1 className="text-xl font-bold tracking-tight">🚬 מעקב עישון</h1>
        <span className="bg-white text-orange-500 rounded-full px-3 py-0.5 text-sm font-bold shadow">
          {todayCount} היום
        </span>
      </div>

      {/* Content */}
      <div className="overflow-y-auto">
        <Suspense
          fallback={
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          }
        >
          {tab === 'home' && <CigaretteHome />}
          {tab === 'stats' && <CigaretteStats />}
          {tab === 'purchases' && <PurchaseTracking />}
          {tab === 'insights' && <CigaretteInsights />}
          {tab === 'settings' && <CigaretteSettings />}
        </Suspense>
      </div>

      {/* Bottom nav */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around shadow z-50"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)', minHeight: 56 }}
      >
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors
              ${tab === id ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}`}
          >
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 10, marginTop: 2 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CigaretteApp() {
  return (
    <CigaretteProvider>
      <CigaretteAppInner />
    </CigaretteProvider>
  );
}
