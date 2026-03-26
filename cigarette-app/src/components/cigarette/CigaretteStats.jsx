import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { useCigarette } from '../../context/CigaretteContext.jsx';

// ── helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function isoWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return toDateStr(d);
}

function buildDailyData(logs, days = 30) {
  const today = toDateStr(new Date());
  const map = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    map[d] = 0;
  }
  logs.forEach((l) => {
    const d = l.timestamp.slice(0, 10);
    if (d in map) map[d]++;
  });
  return Object.entries(map).map(([date, count]) => ({
    date: date.slice(5), // MM-DD
    count,
  }));
}

function buildHourlyData(logs) {
  const map = {};
  for (let h = 0; h < 24; h++) map[h] = 0;
  logs.forEach((l) => {
    const h = new Date(l.timestamp).getHours();
    map[h]++;
  });
  return Object.entries(map).map(([hour, count]) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    count,
  }));
}

function buildWeeklyData(logs) {
  const map = {};
  logs.forEach((l) => {
    const week = isoWeekStart(l.timestamp.slice(0, 10));
    map[week] = (map[week] || 0) + 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, count]) => ({ week: week.slice(5), count }));
}

function buildMonthlyData(logs) {
  const map = {};
  logs.forEach((l) => {
    const month = l.timestamp.slice(0, 7); // YYYY-MM
    map[month] = (map[month] || 0) + 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));
}

// ── component ─────────────────────────────────────────────────────────────────

const TABS = ['יומי', 'שבועי', 'חודשי', 'שעתי'];

export default function CigaretteStats() {
  const { logs } = useCigarette();
  const [tab, setTab] = useState(0);

  const daily = useMemo(() => buildDailyData(logs, 30), [logs]);
  const weekly = useMemo(() => buildWeeklyData(logs), [logs]);
  const monthly = useMemo(() => buildMonthlyData(logs), [logs]);
  const hourly = useMemo(() => buildHourlyData(logs), [logs]);

  // Summary stats
  const totalAll = logs.length;
  const today = toDateStr(new Date());
  const todayCount = logs.filter((l) => l.timestamp.slice(0, 10) === today).length;

  const last7 = logs.filter((l) => {
    const d = new Date(l.timestamp);
    const days7Ago = new Date();
    days7Ago.setDate(days7Ago.getDate() - 7);
    return d >= days7Ago;
  }).length;

  const avgPerDay7 = (last7 / 7).toFixed(1);

  const peakHour = useMemo(() => {
    if (logs.length === 0) return '—';
    const hMap = {};
    logs.forEach((l) => {
      const h = new Date(l.timestamp).getHours();
      hMap[h] = (hMap[h] || 0) + 1;
    });
    const peak = Object.entries(hMap).sort(([, a], [, b]) => b - a)[0];
    return peak ? `${String(peak[0]).padStart(2, '0')}:00` : '—';
  }, [logs]);

  const chartData = [daily, weekly, monthly, hourly][tab];
  const xKey = ['date', 'week', 'month', 'hour'][tab];

  const barColor = '#f97316'; // orange-500
const CHART_MARGIN = { top: 5, right: 5, left: -20, bottom: 5 };
const xAxisProps = (dataKey) => ({ dataKey, tick: { fontSize: 10 }, interval: 'preserveStartEnd' });
const yAxisProps = { tick: { fontSize: 10 }, allowDecimals: false };

  return (
    <div className="px-4 py-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: 'סה"כ', value: totalAll },
          { label: 'היום', value: todayCount },
          { label: '7 ימים', value: last7 },
          { label: 'ממוצע יומי (שבוע)', value: avgPerDay7 },
          { label: 'שעת שיא', value: peakHour },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-3 flex flex-col items-center"
          >
            <span className="text-2xl font-bold text-orange-500">{value}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</span>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === i
                ? 'bg-white dark:bg-gray-700 text-orange-500 shadow'
                : 'text-gray-500 dark:text-gray-400'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-2">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
            אין נתונים להצגה
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            {tab === 0 ? (
              <LineChart data={chartData} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis {...xAxisProps(xKey)} />
                <YAxis {...yAxisProps} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke={barColor} strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis {...xAxisProps(xKey)} />
                <YAxis {...yAxisProps} />
                <Tooltip />
                <Bar dataKey="count" fill={barColor} radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
