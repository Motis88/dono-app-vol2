import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  cigaretteLogStorage,
  purchaseStorage,
  settingsStorage,
} from '../utils/cigaretteStorage.js';

const CigaretteContext = createContext(null);

export function CigaretteProvider({ children }) {
  const [logs, setLogs] = useState(() => cigaretteLogStorage.getAll());
  const [purchases, setPurchases] = useState(() => purchaseStorage.getAll());
  const [settings, setSettings] = useState(() => settingsStorage.get());

  const addLog = useCallback(() => {
    const newLog = cigaretteLogStorage.addLog({});
    setLogs(cigaretteLogStorage.getAll());
    return newLog;
  }, []);

  const removeLog = useCallback((id) => {
    cigaretteLogStorage.removeLog(id);
    setLogs(cigaretteLogStorage.getAll());
  }, []);

  const addPurchase = useCallback((purchase) => {
    const newPurchase = purchaseStorage.addPurchase(purchase);
    setPurchases(purchaseStorage.getAll());
    return newPurchase;
  }, []);

  const removePurchase = useCallback((id) => {
    purchaseStorage.removePurchase(id);
    setPurchases(purchaseStorage.getAll());
  }, []);

  const saveSettings = useCallback((newSettings) => {
    settingsStorage.save(newSettings);
    setSettings(newSettings);
  }, []);

  // Derived helpers exposed to consumers
  const getTodayLogs = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    return logs.filter((l) => l.timestamp.slice(0, 10) === today);
  }, [logs]);

  const getTodayCount = useCallback(() => getTodayLogs().length, [getTodayLogs]);

  return (
    <CigaretteContext.Provider
      value={{
        logs,
        purchases,
        settings,
        addLog,
        removeLog,
        addPurchase,
        removePurchase,
        saveSettings,
        getTodayLogs,
        getTodayCount,
      }}
    >
      {children}
    </CigaretteContext.Provider>
  );
}

export function useCigarette() {
  const ctx = useContext(CigaretteContext);
  if (!ctx) throw new Error('useCigarette must be used inside CigaretteProvider');
  return ctx;
}
