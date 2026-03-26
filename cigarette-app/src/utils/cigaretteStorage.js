import { storage } from './storage.js';

export const CIGARETTE_KEYS = {
  LOGS: 'cigarette_logs',
  PURCHASES: 'cigarette_purchases',
  SETTINGS: 'cigarette_settings',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function toDateStr(date) {
  return new Date(date).toISOString().slice(0, 10);
}

// ── cigaretteLogStorage ───────────────────────────────────────────────────────

export const cigaretteLogStorage = {
  getAll() {
    return storage.getItem(CIGARETTE_KEYS.LOGS, []);
  },

  saveAll(logs) {
    return storage.setItem(CIGARETTE_KEYS.LOGS, logs);
  },

  addLog(log) {
    const logs = this.getAll();
    const newLog = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.saveAll([...logs, newLog]);
    return newLog;
  },

  removeLog(id) {
    const logs = this.getAll().filter((l) => l.id !== id);
    this.saveAll(logs);
  },

  getForDate(dateStr) {
    return this.getAll().filter((l) => toDateStr(l.timestamp) === dateStr);
  },

  getForRange(startDate, endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return this.getAll().filter((l) => {
      const t = new Date(l.timestamp).getTime();
      return t >= start && t <= end;
    });
  },
};

// ── purchaseStorage ───────────────────────────────────────────────────────────

export const purchaseStorage = {
  getAll() {
    return storage.getItem(CIGARETTE_KEYS.PURCHASES, []);
  },

  saveAll(purchases) {
    return storage.setItem(CIGARETTE_KEYS.PURCHASES, purchases);
  },

  addPurchase(purchase) {
    const purchases = this.getAll();
    const newPurchase = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      date: toDateStr(new Date()),
      ...purchase,
    };
    this.saveAll([...purchases, newPurchase]);
    return newPurchase;
  },

  removePurchase(id) {
    const purchases = this.getAll().filter((p) => p.id !== id);
    this.saveAll(purchases);
  },

  getForMonth(year, month) {
    return this.getAll().filter((p) => {
      const d = new Date(p.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  },
};

// ── settingsStorage ───────────────────────────────────────────────────────────

export const settingsStorage = {
  get() {
    return storage.getItem(CIGARETTE_KEYS.SETTINGS, {
      gramsPerCigarette: 0.7,
      currency: '₪',
    });
  },

  save(settings) {
    return storage.setItem(CIGARETTE_KEYS.SETTINGS, settings);
  },
};
