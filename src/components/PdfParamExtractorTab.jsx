import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function ExcelMonthlySummary() {
  const [filesWithMonths, setFilesWithMonths] = useState([]);
  const [monthlySummaries, setMonthlySummaries] = useState({});

  // ✅ נירמול שם פריט
  const normalizeName = (name) => {
    return name
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^א-ת\s\-–—"׳"`'.()/_\\]/g, '')
      .replace(/[\-–—"׳"`'.()/_\\]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // ✅ קריאה מה-localStorage בתחילת הריצה
  useEffect(() => {
    const savedSummaries = localStorage.getItem('monthlySummaries');
    if (savedSummaries) {
      setMonthlySummaries(JSON.parse(savedSummaries));
    }
  }, []);

  // ✅ כל שינוי ב-summaries ישמר אוטומטית ב-localStorage
  useEffect(() => {
    localStorage.setItem('monthlySummaries', JSON.stringify(monthlySummaries));
  }, [monthlySummaries]);

  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const updatedFiles = selectedFiles.map((file) => ({
      file,
      month: '',
    }));
    setFilesWithMonths((prev) => [...prev, ...updatedFiles]);
  };

  const updateMonth = (index, value) => {
    const updated = [...filesWithMonths];
    updated[index].month = value;
    setFilesWithMonths(updated);
  };

  const processFiles = async () => {
    const newSummaries = { ...monthlySummaries };

    for (const item of filesWithMonths) {
      const { file, month } = item;
      if (!month) {
        alert(`יש להזין חודש עבור הקובץ: ${file.name}`);
        return;
      }

      const reader = new FileReader();

      const data = await new Promise((resolve) => {
        reader.onload = (e) => {
          const binaryStr = e.target.result;
          const workbook = XLSX.read(binaryStr, { type: 'binary' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const headerRowIndex = findHeaderRowIndex(sheet);
          const parsed = XLSX.utils.sheet_to_json(sheet, {
            defval: '',
            range: headerRowIndex,
          });
          resolve(parsed);
        };
        reader.readAsBinaryString(file);
      });

      const summaryMap = {};

      data.forEach((row) => {
        const rawName = row['Name']?.toString().trim();
        if (!rawName) return;

        const name = normalizeName(rawName);
        const quantity = parseFloat(row['Quantity']) || 0;
        const totalInclVat = parseFloat(row['Total incl. VAT']) || 0;

        if (!summaryMap[name]) {
          summaryMap[name] = {
            name: name,
            totalQuantity: 0,
            totalAmount: 0,
          };
        }

        summaryMap[name].totalQuantity += quantity;
        summaryMap[name].totalAmount += totalInclVat;
      });

      newSummaries[month] = Object.values(summaryMap);
    }

    setMonthlySummaries(newSummaries);
    setFilesWithMonths([]); // מנקה את רשימת הקבצים שהוזנו לאחר עיבוד
  };

  const findHeaderRowIndex = (sheet) => {
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const headers = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = { c: C, r: R };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        const cell = sheet[cellRef];
        if (cell && cell.v) {
          headers.push(cell.v.toString().toLowerCase());
        }
      }

      const headerMatch = headers.some((h) =>
        h.includes('name') || h.includes('quantity') || h.includes('total') || h.includes('price')
      );

      if (headerMatch) {
        return R;
      }
    }

    return 0;
  };

  const clearAllData = () => {
    localStorage.removeItem('monthlySummaries');
    setMonthlySummaries({});
  };

  return (
    <div className="p-6 space-y-4">
      <input type="file" accept=".xls,.xlsx" multiple onChange={handleFileInput} />

      {filesWithMonths.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span>{item.file.name}</span>
          <input
            type="text"
            placeholder="הכנס חודש (למשל אפריל 2025)"
            value={item.month}
            onChange={(e) => updateMonth(index, e.target.value)}
            className="border px-2 py-1"
          />
        </div>
      ))}

      {filesWithMonths.length > 0 && (
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={processFiles}
        >
          עיבוד קבצים
        </button>
      )}

      {Object.entries(monthlySummaries).map(([month, summary]) => (
        <div key={month} className="mt-6">
          <h2 className="text-xl font-bold mb-2">{month}</h2>
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">סוג פריט</th>
                <th className="border p-2">סך כמות</th>
                <th className="border p-2">סך כולל (כולל מע״מ)</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border p-2">{item.name}</td>
                  <td className="border p-2">{item.totalQuantity}</td>
                  <td className="border p-2">{item.totalAmount.toFixed(2)} ₪</td>
                </tr>
              ))}
              <tr className="bg-yellow-100 font-bold">
                <td className="border p-2 text-right" colSpan={2}>
                  סה״כ
                </td>
                <td className="border p-2">
                  {summary.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2)} ₪
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {Object.keys(monthlySummaries).length > 0 && (
        <button
          className="bg-red-600 text-white px-4 py-2 rounded mt-6"
          onClick={clearAllData}
        >
          נקה הכל
        </button>
      )}
    </div>
  );
}
