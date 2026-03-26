import React, { useState, useCallback } from 'react';
import { useCigarette } from '../../context/CigaretteContext.jsx';

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function CigaretteHome() {
  const { addLog, removeLog, getTodayLogs, getTodayCount } = useCigarette();
  const [flash, setFlash] = useState(false);

  const todayLogs = getTodayLogs();
  const todayCount = getTodayCount();

  const handleAdd = useCallback(() => {
    addLog();
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    if (navigator.vibrate) navigator.vibrate(50);
  }, [addLog]);

  const today = formatDate(new Date().toISOString());

  return (
    <div className="flex flex-col items-center gap-6 py-6 px-4">
      {/* Date */}
      <p className="text-sm text-gray-500 dark:text-gray-400">{today}</p>

      {/* Daily counter */}
      <div className="flex flex-col items-center">
        <span className="text-7xl font-extrabold text-gray-800 dark:text-gray-100 leading-none">
          {todayCount}
        </span>
        <span className="mt-1 text-sm text-gray-500 dark:text-gray-400">סיגריות היום</span>
      </div>

      {/* Big add button */}
      <button
        onClick={handleAdd}
        className={`
          w-44 h-44 rounded-full text-white text-6xl shadow-2xl
          flex items-center justify-center select-none
          transition-all duration-150 active:scale-95
          ${flash ? 'bg-orange-400 scale-95' : 'bg-orange-500 hover:bg-orange-600'}
        `}
        aria-label="הוסף סיגריה"
      >
        🚬
      </button>
      <p className="text-xs text-gray-400 dark:text-gray-500">לחץ להוסיף סיגריה</p>

      {/* Today's timeline */}
      {todayLogs.length > 0 && (
        <div className="w-full max-w-sm">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">ציר זמן היום</h2>
          <ul className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {[...todayLogs].reverse().map((log, idx) => (
              <li
                key={log.id}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm text-sm"
              >
                <span className="text-gray-500 dark:text-gray-400 w-6 text-right">{todayLogs.length - idx}</span>
                <span className="text-orange-500 mx-2">🚬</span>
                <span className="flex-1 text-gray-700 dark:text-gray-200">{formatTime(log.timestamp)}</span>
                <button
                  onClick={() => removeLog(log.id)}
                  className="text-red-400 hover:text-red-600 text-xs ml-2"
                  aria-label="מחק"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {todayLogs.length === 0 && (
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-4">אין סיגריות מתועדות היום 🎉</p>
      )}
    </div>
  );
}
