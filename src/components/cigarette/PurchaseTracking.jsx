import React, { useState } from 'react';
import { useCigarette } from '../../context/CigaretteContext.jsx';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const INITIAL_FORM = { date: new Date().toISOString().slice(0, 10), grams: '', packs: '', price: '', notes: '' };

export default function PurchaseTracking() {
  const { purchases, addPurchase, removePurchase, settings } = useCigarette();
  const [form, setForm] = useState(INITIAL_FORM);
  const [showForm, setShowForm] = useState(false);

  const currency = settings.currency || '₪';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.price) return;
    addPurchase({
      date: form.date,
      grams: form.grams ? parseFloat(form.grams) : null,
      packs: form.packs ? parseFloat(form.packs) : null,
      price: parseFloat(form.price),
      notes: form.notes,
    });
    setForm(INITIAL_FORM);
    setShowForm(false);
  };

  // Totals
  const totalSpent = purchases.reduce((s, p) => s + (p.price || 0), 0);
  const totalGrams = purchases.reduce((s, p) => s + (p.grams || 0), 0);
  const costPerGram = totalGrams > 0 ? totalSpent / totalGrams : null;

  // This month
  const now = new Date();
  const thisMonthPurchases = purchases.filter((p) => {
    const d = new Date(p.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const thisMonthSpent = thisMonthPurchases.reduce((s, p) => s + (p.price || 0), 0);

  return (
    <div className="px-4 py-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'סה"כ הוצאה', value: `${currency}${totalSpent.toFixed(2)}` },
          { label: 'החודש', value: `${currency}${thisMonthSpent.toFixed(2)}` },
          { label: 'עלות לגרם', value: costPerGram ? `${currency}${costPerGram.toFixed(2)}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow p-2 flex flex-col items-center text-center">
            <span className="text-base font-bold text-orange-500 leading-tight">{value}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</span>
          </div>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowForm((v) => !v)}
        className="w-full mb-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow transition-colors"
      >
        {showForm ? '✕ ביטול' : '+ הוסף רכישה'}
      </button>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
              תאריך
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="border dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
              מחיר ({currency}) *
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                className="border dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
              גרמים
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={form.grams}
                onChange={(e) => setForm({ ...form, grams: e.target.value })}
                className="border dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
              חפיסות
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={form.packs}
                onChange={(e) => setForm({ ...form, packs: e.target.value })}
                className="border dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
            הערות
            <input
              type="text"
              placeholder="הערה אופציונלית"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="border dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            שמור
          </button>
        </form>
      )}

      {/* Purchases list */}
      <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">היסטוריית רכישות</h2>
      {purchases.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm">אין רכישות מתועדות עדיין</p>
      ) : (
        <ul className="space-y-2">
          {[...purchases].reverse().map((p) => (
            <li key={p.id} className="bg-white dark:bg-gray-800 rounded-xl shadow px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {currency}{p.price?.toFixed(2)}
                  {p.grams ? ` · ${p.grams}ג` : ''}
                  {p.packs ? ` · ${p.packs} חפיסות` : ''}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{formatDate(p.date)}{p.notes ? ` · ${p.notes}` : ''}</div>
              </div>
              <button
                onClick={() => removePurchase(p.id)}
                className="text-red-400 hover:text-red-600 text-xs"
                aria-label="מחק"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
