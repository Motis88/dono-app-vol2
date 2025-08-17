import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const PdfParamExtractorTab = () => {
  const [summary, setSummary] = useState({});
  const [total, setTotal] = useState(0);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { range: 4 }); // מתחיל בשורה 5

      const result = {};
      let totalSum = 0;

      rows.forEach((row) => {
        const name = row["Name"];
        const quantity = parseFloat(row["Quantity"]);
        const price = parseFloat(row["Total incl. VAT"]);

        if (!name || isNaN(quantity) || isNaN(price)) return;

        if (!result[name]) {
          result[name] = { quantity: 0, total: 0 };
        }

        result[name].quantity += quantity;
        result[name].total += price;
        totalSum += price;
      });

      setSummary(result);
      setTotal(totalSum);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Excel Sales Summary</h2>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Quantity</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(summary).map(([name, data]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{data.quantity}</td>
              <td>₪{data.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><strong>Total This Month:</strong> ₪{total.toFixed(2)}</p>
    </div>
  );
};

export default PdfParamExtractorTab;
