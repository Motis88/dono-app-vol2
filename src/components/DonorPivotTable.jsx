import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const getMonthKey = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes("-")) return dateStr.slice(0, 7);
  if (dateStr.includes("/")) {
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month.padStart(2, "0")}`;
  }
  return dateStr;
};

const formatMonth = (key) => {
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  const date = new Date(`${year}-${month}-01`);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const isDonatedYes = (str) => {
  if (!str) return false;
  return (
    str.trim().toLowerCase() === "yes" ||
    str.trim().toLowerCase() === "כן"
  );
};

const DonorPivotTable = ({ donors }) => {
  const [modal, setModal] = useState(null);

  // locations & months
  const locations = [...new Set(donors.map(d => d.location).filter(Boolean))];
  const months = [...new Set(donors.map(d => getMonthKey(d.date)).filter(Boolean))].sort().reverse();
  const animalTypes = ["Dog", "Cat"];

  // build pivot data
  const pivot = months.map(month => {
    let row = { month };
    locations.forEach(loc => {
      animalTypes.forEach(animal => {
        row[`${loc}_${animal}`] = donors.filter(
          d =>
            getMonthKey(d.date) === month &&
            d.location === loc &&
            (d.animalType?.toLowerCase() === animal.toLowerCase()) &&
            isDonatedYes(d.donated)
        ).length;
      });
    });
    row["totalDog"] = locations.reduce(
      (sum, loc) => sum + (row[`${loc}_Dog`] || 0),
      0
    );
    row["totalCat"] = locations.reduce(
      (sum, loc) => sum + (row[`${loc}_Cat`] || 0),
      0
    );
    row["total"] = row["totalDog"] + row["totalCat"];
    return row;
  });

  // details for modal
  const getMonthDetails = (month) => {
    const result = [];
    locations.forEach(loc => {
      const dog = donors.filter(
        d =>
          getMonthKey(d.date) === month &&
          d.location === loc &&
          (d.animalType?.toLowerCase() === "dog") &&
          isDonatedYes(d.donated)
      ).length;
      const cat = donors.filter(
        d =>
          getMonthKey(d.date) === month &&
          d.location === loc &&
          (d.animalType?.toLowerCase() === "cat") &&
          isDonatedYes(d.donated)
      ).length;
      if (dog > 0 || cat > 0) {
        result.push({ location: loc, dog, cat, total: dog + cat });
      }
    });
    return result.sort((a, b) => b.total - a.total); // sort descending by total
  };

  return (
    <div className="overflow-x-auto max-w-[370px] mx-auto">
      {/* ---- TITLE ---- */}
      <div className="font-bold text-lg mb-3 mt-2 text-center text-blue-600 tracking-wide">
        Monthly Donor Summary
      </div>
      {/* ---- TABLE ---- */}
      <table className="min-w-max border-collapse border border-gray-300 bg-white shadow text-xs">
        <thead>
          <tr>
            <th className="border px-2 py-1 bg-gray-100">Month</th>
            {locations.map(loc => (
              <React.Fragment key={loc}>
                <th className="border px-2 py-1 bg-gray-50">{loc} Dog</th>
                <th className="border px-2 py-1 bg-gray-50">{loc} Cat</th>
              </React.Fragment>
            ))}
            <th className="border px-2 py-1 bg-blue-100">TOTAL DOG</th>
            <th className="border px-2 py-1 bg-pink-100">TOTAL CAT</th>
            <th className="border px-2 py-1 bg-gray-200">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {pivot.map(row => (
            <tr key={row.month}>
              <td
                className="border px-2 py-1 font-semibold hover:bg-blue-100 cursor-pointer"
                style={{ minWidth: 80 }}
                onClick={() => setModal(row.month)}
              >
                {formatMonth(row.month)}
              </td>
              {locations.map(loc => (
                <React.Fragment key={loc}>
                  <td className="border px-2 py-1 text-center">{row[`${loc}_Dog`]}</td>
                  <td className="border px-2 py-1 text-center">{row[`${loc}_Cat`]}</td>
                </React.Fragment>
              ))}
              <td className="border px-2 py-1 font-bold bg-blue-50 text-blue-800">{row["totalDog"]}</td>
              <td className="border px-2 py-1 font-bold bg-pink-50 text-pink-800">{row["totalCat"]}</td>
              <td className="border px-2 py-1 font-bold bg-gray-100">{row["total"]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---- MODAL ---- */}
      {modal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-[320px] w-full p-4 text-xs"
            onClick={e => e.stopPropagation()}
          >
            <div className="font-bold text-blue-600 mb-2 text-center text-sm">
              {formatMonth(modal)} — Donor Locations
            </div>
            <table className="w-full border border-gray-200 mb-2">
              <thead>
                <tr>
                  <th className="border px-1 py-1 bg-gray-100 text-xs">Location</th>
                  <th className="border px-1 py-1 bg-blue-50 text-xs">Dogs</th>
                  <th className="border px-1 py-1 bg-pink-50 text-xs">Cats</th>
                  <th className="border px-1 py-1 bg-gray-200 text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {getMonthDetails(modal).map(row => (
                  <tr key={row.location}>
                    <td className="border px-1 py-1">{row.location}</td>
                    <td className="border px-1 py-1 text-center text-blue-700 font-bold">{row.dog}</td>
                    <td className="border px-1 py-1 text-center text-pink-600 font-bold">{row.cat}</td>
                    <td className="border px-1 py-1 text-center">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="w-full py-1 mt-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold"
              onClick={() => setModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ---- BAR CHART ---- */}
      <div className="mt-8 bg-white rounded shadow p-2">
        <h2 className="text-sm font-bold mb-2 text-center">Monthly Donor Summary (Chart)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={pivot.slice().reverse()}
            margin={{ top: 10, right: 15, left: 0, bottom: 15 }}
          >
            <XAxis dataKey="month" tickFormatter={formatMonth} fontSize={10} angle={-40} textAnchor="end" height={60} />
            <YAxis fontSize={10} />
            <Tooltip labelFormatter={formatMonth} />
            <Legend />
            <Bar dataKey="totalDog" fill="#60a5fa" name="Total Dogs" />
            <Bar dataKey="totalCat" fill="#f472b6" name="Total Cats" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DonorPivotTable;
