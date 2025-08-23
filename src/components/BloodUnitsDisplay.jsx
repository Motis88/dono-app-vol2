import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import './BloodUnitsDisplay.css';

// נתוני דוגמה לשימוש
const getSampleUsageData = () => [
  {
    'Created timestamp': '2024-01-15 10:30',
    'Medicine': 'מנת דם חתול A+',
    'Quantity (packages)': '2',
    'Client': 'מרפאת חיות ירושלים',
    'Patient name': 'מיטי',
    'Veterinarian': 'ד"ר כהן'
  },
  {
    'Created timestamp': '2024-01-16 14:15',
    'Medicine': 'מנת דם כלב B+',
    'Quantity (packages)': '1',
    'Client': 'מרפאת חיות תל אביב',
    'Patient name': 'רקס',
    'Veterinarian': 'ד"ר לוי'
  },
  {
    'Created timestamp': '2024-01-17 09:45',
    'Medicine': 'מנת דם חתול O',
    'Quantity (packages)': '3',
    'Client': 'מרפאת חיות חיפה',
    'Patient name': 'לונה',
    'Veterinarian': 'ד"ר אברהם'
  }
];

// נתוני חשבוניות לדוגמה
const getSampleInvoiceData = () => [
  {
    'Date': '2024-01-15',
    'Invoice': 'INV-001',
    'Client': 'מרפאת חיות ירושלים',
    'Amount': '450',
    'Blood Type': 'חתול A+'
  }
];

function BloodUnitsDisplay() {
  const [usageData, setUsageData] = useState([]);
  const [invoiceData, setInvoiceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // קריאת קבצי CSV או שימוש בנתונים לדוגמה
    const loadCSVData = async () => {
      try {
        // ניסיון לטעון קבצי CSV
        let usageParsed = null;
        let invoiceParsed = null;
        
        try {
          const usageResponse = await fetch('/data/blood-units-usage.csv');
          if (!usageResponse.ok) throw new Error('CSV file not found');
          const usageText = await usageResponse.text();
          
          const invoiceResponse = await fetch('/data/blood-units-invoice.csv');
          if (!invoiceResponse.ok) throw new Error('CSV file not found');
          const invoiceText = await invoiceResponse.text();
          
          // פירוק ה-CSV עם תמיכה בעברית
          const parseOptions = { 
            header: true,
            skipEmptyLines: true,
            encoding: 'UTF-8'
          };
          
          usageParsed = Papa.parse(usageText, parseOptions);
          invoiceParsed = Papa.parse(invoiceText, parseOptions);
          
          setUsageData(usageParsed.data);
          setInvoiceData(invoiceParsed.data);
        } catch (fetchError) {
          // אם הקבצים לא נמצאו, השתמש בנתונים לדוגמה
          console.log('קבצי CSV לא נמצאו, משתמש בנתונים לדוגמה');
          const sampleUsage = getSampleUsageData();
          const sampleInvoice = getSampleInvoiceData();
          setUsageData(sampleUsage);
          setInvoiceData(sampleInvoice);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('שגיאה בטעינת נתונים:', err);
        setError('אירעה שגיאה בטעינת הנתונים. מציג נתונים לדוגמה.');
        const sampleUsage = getSampleUsageData();
        const sampleInvoice = getSampleInvoiceData();
        setUsageData(sampleUsage);
        setInvoiceData(sampleInvoice);
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
  
  const totals = calculateTotalByType();

  return (
    <div className="blood-units-container" dir="rtl">
      <h1>נתוני מנות דם</h1>
      
      {error && <div className="error">{error}</div>}
      
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
            {usageData.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  אין נתונים להצגה
                </td>
              </tr>
            ) : (
              usageData.map((row, index) => (
                <tr key={index}>
                  <td>{row['Created timestamp']}</td>
                  <td>{row['Medicine']}</td>
                  <td>{row['Quantity (packages)']}</td>
                  <td>{row['Client']}</td>
                  <td>{row['Patient name']}</td>
                  <td>{row['Veterinarian']}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* ניתן להוסיף טבלה נוספת לחשבוניות בדומה */}
    </div>
  );
}

export default BloodUnitsDisplay;