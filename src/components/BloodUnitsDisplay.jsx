import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import './BloodUnitsDisplay.css';

function BloodUnitsDisplay() {
  const [usageData, setUsageData] = useState([]);
  const [invoiceData, setInvoiceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // קריאת קבצי CSV
    const loadCSVData = async () => {
      try {
        // טעינת קובץ נתוני שימוש
        const usageResponse = await fetch('/data/blood-units-usage.csv');
        const usageText = await usageResponse.text();
        
        // טעינת קובץ נתוני חשבוניות
        const invoiceResponse = await fetch('/data/blood-units-invoice.csv');
        const invoiceText = await invoiceResponse.text();
        
        // פירוק ה-CSV עם תמיכה בעברית
        const parseOptions = { 
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8'
        };
        
        const usageParsed = Papa.parse(usageText, parseOptions);
        const invoiceParsed = Papa.parse(invoiceText, parseOptions);
        
        setUsageData(usageParsed.data);
        setInvoiceData(invoiceParsed.data);
        setLoading(false);
      } catch (err) {
        console.error('שגיאה בטעינת נתונים:', err);
        setError('אירעה שגיאה בטעינת הנתונים. נא לנסות שוב.');
        setLoading(false);
      }
    };
    
    loadCSVData();
  }, []);

  // חישוב סך הכל מנות דם לפי סוג
  const calculateTotalByType = () => {
    const totals = {
      cat: usageData.filter(row => row.Medicine?.includes('חתול')).length,
      dog: usageData.filter(row => row.Medicine?.includes('כלב')).length
    };
    return totals;
  };

  if (loading) return <div className="loading">טוען נתונים...</div>;
  if (error) return <div className="error">{error}</div>;
  
  const totals = calculateTotalByType();

  return (
    <div className="blood-units-container" dir="rtl">
      <h1>נתוני מנות דם</h1>
      
      <div className="summary-stats">
        <div className="stat-card">
          <h3>סה"כ מנות דם חתול</h3>
          <p className="stat-value">{totals.cat}</p>
        </div>
        <div className="stat-card">
          <h3>סה"כ מנות דם כלב</h3>
          <p className="stat-value">{totals.dog}</p>
        </div>
      </div>
      
      <h2>נתוני שימוש במנות דם</h2>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>תאריך</th>
              <th>תרופה</th>
              <th>כמות</th>
              <th>לקוח</th>
              <th>שם המטופל</th>
              <th>וטרינר</th>
            </tr>
          </thead>
          <tbody>
            {usageData.map((row, index) => (
              <tr key={index}>
                <td>{row['Created timestamp']}</td>
                <td>{row['Medicine']}</td>
                <td>{row['Quantity (packages)']}</td>
                <td>{row['Client']}</td>
                <td>{row['Patient name']}</td>
                <td>{row['Veterinarian']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* ניתן להוסיף טבלה נוספת לחשבוניות בדומה */}
    </div>
  );
}

export default BloodUnitsDisplay;