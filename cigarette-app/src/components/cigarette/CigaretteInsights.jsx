import React, { useMemo } from 'react';
import { useCigarette } from '../../context/CigaretteContext.jsx';

function minutesToHuman(minutes) {
  if (!isFinite(minutes) || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}ש' ${m}ד'`;
  return `${m} דקות`;
}

export default function CigaretteInsights() {
  const { logs, purchases, settings } = useCigarette();

  const currency = settings.currency || '₪';
  const gramsPerCig = settings.gramsPerCigarette || 0.7;

  const now = new Date();

  // ── Avg time between cigarettes (using last 7 days) ───────────────────────
  const avgTimeBetween = useMemo(() => {
    const sorted = [...logs]
      .filter((l) => {
        const d = new Date(l.timestamp);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return d >= sevenDaysAgo;
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (sorted.length < 2) return null;
    let totalGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalGap += new Date(sorted[i].timestamp) - new Date(sorted[i - 1].timestamp);
    }
    return totalGap / (sorted.length - 1) / 60000; // minutes
  }, [logs]);

  // ── Trend (comparing last 7 days vs previous 7 days) ─────────────────────
  const trend = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const last7 = logs.filter((l) => new Date(l.timestamp) >= sevenDaysAgo).length;
    const prev7 = logs.filter((l) => {
      const d = new Date(l.timestamp);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    }).length;

    if (prev7 === 0) return { label: '—', icon: '➡️', pct: null };
    const change = ((last7 - prev7) / prev7) * 100;
    if (Math.abs(change) < 5) return { label: 'יציב', icon: '➡️', pct: change.toFixed(0) };
    if (change > 0) return { label: 'עולה', icon: '📈', pct: change.toFixed(0) };
    return { label: 'יורד', icon: '📉', pct: Math.abs(change).toFixed(0) };
  }, [logs]);

  // ── Estimated monthly spending ─────────────────────────────────────────────
  const estimatedMonthlySpend = useMemo(() => {
    // Based on purchase cost per gram × avg grams used per month
    const totalGrams = purchases.reduce((s, p) => s + (p.grams || 0), 0);
    const totalSpent = purchases.reduce((s, p) => s + (p.price || 0), 0);
    if (totalGrams === 0 || totalSpent === 0) return null;

    const costPerGram = totalSpent / totalGrams;

    // Avg daily cigarettes over last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30Count = logs.filter((l) => new Date(l.timestamp) >= thirtyDaysAgo).length;
    const avgDailyCigs = last30Count / 30;

    const monthlyCigs = avgDailyCigs * 30;
    const monthlyGrams = monthlyCigs * gramsPerCig;
    return costPerGram * monthlyGrams;
  }, [logs, purchases, gramsPerCig]);

  // ── Avg daily cigarettes (all time) ───────────────────────────────────────
  const avgDailyAllTime = useMemo(() => {
    if (logs.length === 0) return 0;
    const sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const firstDate = new Date(sorted[0].timestamp);
    const daysDiff = Math.max(1, (now - firstDate) / 86400000);
    return (logs.length / daysDiff).toFixed(1);
  }, [logs, now]);

  // ── Daily streak (days with at least 1 cigarette) ─────────────────────────
  const streak = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dates = new Set(logs.map((l) => l.timestamp.slice(0, 10)));
    let s = 0;
    let current = today;
    while (dates.has(current)) {
      s++;
      const d = new Date(current);
      d.setDate(d.getDate() - 1);
      current = d.toISOString().slice(0, 10);
    }
    return s;
  }, [logs]);

  const insights = [
    {
      icon: '⏱️',
      label: 'זמן ממוצע בין סיגריות',
      value: avgTimeBetween !== null ? minutesToHuman(avgTimeBetween) : '—',
      sub: 'בשבוע האחרון',
    },
    {
      icon: trend.icon,
      label: 'מגמה',
      value: trend.pct ? `${trend.label} ${trend.pct}%` : trend.label,
      sub: 'שבוע אחרון לעומת שבוע קודם',
    },
    {
      icon: '💸',
      label: 'הוצאה חודשית משוערת',
      value: estimatedMonthlySpend !== null ? `${currency}${estimatedMonthlySpend.toFixed(2)}` : '—',
      sub: 'בהתבסס על נתוני רכישות',
    },
    {
      icon: '📅',
      label: 'ממוצע יומי',
      value: `${avgDailyAllTime} סיגריות`,
      sub: 'מאז התיעוד הראשון',
    },
    {
      icon: '🔥',
      label: 'רצף ימים',
      value: `${streak} ימים`,
      sub: 'ימים רצופים עם סיגריות',
    },
    {
      icon: '📦',
      label: 'גרם לסיגריה (הגדרה)',
      value: `${gramsPerCig}ג`,
      sub: 'ניתן לשנות בהגדרות',
    },
  ];

  return (
    <div className="px-4 py-4">
      <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-lg">תובנות</h2>
      {logs.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          התחל לתעד סיגריות כדי לראות תובנות אישיות
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {insights.map(({ icon, label, value, sub }) => (
            <div
              key={label}
              className="bg-white dark:bg-gray-800 rounded-xl shadow px-4 py-3 flex items-center gap-4"
            >
              <span className="text-3xl">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
                <div className="text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight">{value}</div>
                {sub && <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
