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
  const [expandedMonths, setExpandedMonths] = useState(new Set());

  // Toggle accordion section
  const toggleMonth = (month) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(month)) {
      newExpanded.delete(month);
    } else {
      newExpanded.add(month);
    }
    setExpandedMonths(newExpanded);
  };

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

  // details for expanded sections
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
    return result.sort((a, b) => b.total - a.total);
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* ---- TITLE ---- */}
      <div className="font-bold text-xl sm:text-2xl mb-6 text-center text-blue-600 tracking-wide">
        Monthly Donor Summary
      </div>
      
      {/* ---- ACCORDION ---- */}
      <div className="space-y-3 sm:space-y-4">
        {pivot.map(row => {
          const isExpanded = expandedMonths.has(row.month);
          const monthDetails = getMonthDetails(row.month);
          
          return (
            <div key={row.month} className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Accordion Header */}
              <button
                onClick={() => toggleMonth(row.month)}
                className="w-full p-4 sm:p-6 text-left bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 transition-all duration-200 border-b border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                      {formatMonth(row.month)}
                    </h3>
                    <div className="flex flex-wrap gap-3 sm:gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm sm:text-base text-blue-700 font-medium">{row.totalDog} Dogs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                        <span className="text-sm sm:text-base text-pink-700 font-medium">{row.totalCat} Cats</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
                        <span className="text-sm sm:text-base text-gray-700 font-semibold">{row.total} Total</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 transform transition-transform duration-200 text-blue-600" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="p-4 sm:p-6 bg-gray-50 animate-fadeIn">
                  <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Location Breakdown</h4>
                  
                  {monthDetails.length > 0 ? (
                    <div className="grid gap-3 sm:gap-4">
                      {monthDetails.map(detail => (
                        <div key={detail.location} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-gray-800 text-sm sm:text-base">{detail.location}</h5>
                            <span className="text-sm font-semibold text-gray-600">{detail.total} donors</span>
                          </div>
                          <div className="flex gap-4 sm:gap-6">
                            <div className="text-center">
                              <div className="text-xl sm:text-2xl font-bold text-blue-600">{detail.dog}</div>
                              <div className="text-xs sm:text-sm text-blue-500">Dogs</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xl sm:text-2xl font-bold text-pink-600">{detail.cat}</div>
                              <div className="text-xs sm:text-sm text-pink-500">Cats</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📊</div>
                      <div className="text-sm sm:text-base">No donations recorded for this month</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- BAR CHART ---- */}
      <div className="mt-8 bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-200">
        <h2 className="text-lg sm:text-xl font-bold mb-4 text-center text-gray-800">Monthly Trends</h2>
        <div className="bg-gray-50 rounded-lg p-3">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={pivot.slice().reverse()}
              margin={{ top: 20, right: 20, left: 10, bottom: 60 }}
            >
              <XAxis 
                dataKey="month" 
                tickFormatter={formatMonth} 
                fontSize={10} 
                angle={-45} 
                textAnchor="end" 
                height={80}
                interval={0}
              />
              <YAxis fontSize={11} />
              <Tooltip 
                labelFormatter={formatMonth}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar dataKey="totalDog" fill="#3b82f6" name="Total Dogs" radius={[2, 2, 0, 0]} />
              <Bar dataKey="totalCat" fill="#ec4899" name="Total Cats" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DonorPivotTable;
