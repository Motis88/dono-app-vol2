import React, { useState } from 'react';
import { useCigarette } from '../../context/CigaretteContext.jsx';

export default function CigaretteSettings() {
  const { settings, saveSettings } = useCigarette();
  const [form, setForm] = useState({
    gramsPerCigarette: settings.gramsPerCigarette ?? 0.7,
    currency: settings.currency ?? '₪',
  });
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    saveSettings({
      gramsPerCigarette: parseFloat(form.gramsPerCigarette),
      currency: form.currency,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="px-4 py-4">
      <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-lg">הגדרות</h2>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 space-y-4">
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          גרמים לסיגריה (לחישוב עלות)
          <input
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={form.gramsPerCigarette}
            onChange={(e) => setForm({ ...form, gramsPerCigarette: e.target.value })}
            className="border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          מטבע
          <input
            type="text"
            maxLength={3}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 w-24"
          />
        </label>
        <button
          type="submit"
          className={`w-full py-2 rounded-lg font-semibold transition-colors text-white
            ${saved ? 'bg-green-500' : 'bg-orange-500 hover:bg-orange-600'}`}
        >
          {saved ? '✓ נשמר!' : 'שמור הגדרות'}
        </button>
      </form>
    </div>
  );
}
