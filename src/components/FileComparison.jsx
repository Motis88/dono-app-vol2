import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const FileComparison = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const [analysisMode, setAnalysisMode] = useState('basic'); // 'basic', 'medicine', 'itemcells'
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    files.forEach(file => processFile(file));
  };

  const processFile = (file) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let parsedData = null;
        let fileType = 'unknown';

        if (fileExtension === 'json') {
          parsedData = JSON.parse(e.target.result);
          fileType = 'json';
        } else if (fileExtension === 'csv') {
          const parsed = Papa.parse(e.target.result, { 
            header: true, 
            skipEmptyLines: true 
          });
          parsedData = parsed.data;
          fileType = 'csv';
        } else if (['xlsx', 'xls'].includes(fileExtension)) {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          parsedData = XLSX.utils.sheet_to_json(sheet);
          fileType = 'excel';
        }

        if (parsedData) {
          const contentType = detectFileContentType(parsedData);
          const newFile = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            type: fileType,
            contentType: contentType,
            uploadDate: new Date().toLocaleString(),
            data: parsedData,
            recordCount: Array.isArray(parsedData) ? parsedData.length : 1
          };

          setUploadedFiles(prev => [...prev, newFile]);
        } else {
          alert(`❌ Unsupported file format: ${fileExtension}`);
        }
      } catch (error) {
        console.error('Error processing file:', error);
        alert(`❌ Error processing file: ${file.name}`);
      }
    };

    if (['xlsx', 'xls'].includes(fileExtension)) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setSelectedFiles(prev => prev.filter(id => id !== fileId));
  };

  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else if (prev.length < 2) {
        return [...prev, fileId];
      } else {
        return [prev[1], fileId]; // Replace oldest selection
      }
    });
  };

  // Detect file content type based on column headers
  const detectFileContentType = (data) => {
    if (!Array.isArray(data) || data.length === 0) return 'unknown';
    
    const sampleRow = data[0];
    const headers = Object.keys(sampleRow).map(h => h.toLowerCase());
    
    // Check for medicine-related fields
    const medicineKeywords = ['dose', 'dosage', 'medicine', 'medication', 'drug', 'treatment', 'external', 'internal', 'route', 'administration'];
    const hasMedicineFields = medicineKeywords.some(keyword => 
      headers.some(header => header.includes(keyword))
    );
    
    // Check for item cells / inventory fields  
    const itemCellsKeywords = ['item', 'cell', 'inventory', 'stock', 'quantity', 'unit', 'batch', 'lot'];
    const hasItemCellsFields = itemCellsKeywords.some(keyword =>
      headers.some(header => header.includes(keyword))
    );
    
    if (hasMedicineFields) return 'medicine';
    if (hasItemCellsFields) return 'itemcells';
    return 'basic';
  };

  // Analyze medicine data for external vs internal comparisons
  const analyzeMedicineData = (files) => {
    const results = [];
    
    files.forEach(file => {
      if (!file.data || !Array.isArray(file.data)) return;
      
      const analysis = {
        fileName: file.name,
        externalDoses: [],
        internalDoses: [],
        doseTypes: new Set(),
        months: new Set()
      };
      
      file.data.forEach(row => {
        // Extract date for monthly analysis
        const dateFields = ['date', 'timestamp', 'created', 'administered'];
        let dateValue = null;
        for (const field of dateFields) {
          if (row[field]) {
            const date = new Date(row[field]);
            if (!isNaN(date)) {
              dateValue = date.toISOString().slice(0, 7); // YYYY-MM format
              analysis.months.add(dateValue);
              break;
            }
          }
        }
        
        // Categorize as external or internal
        const routeFields = ['route', 'administration', 'method', 'location', 'type'];
        let isExternal = false;
        let isInternal = false;
        
        for (const field of routeFields) {
          if (row[field]) {
            const value = String(row[field]).toLowerCase();
            if (value.includes('external') || value.includes('topical') || value.includes('skin')) {
              isExternal = true;
            } else if (value.includes('internal') || value.includes('oral') || value.includes('injection') || value.includes('iv')) {
              isInternal = true;
            }
          }
        }
        
        // Extract dose information
        const doseFields = ['dose', 'dosage', 'amount', 'quantity', 'volume'];
        let doseValue = null;
        let doseUnit = '';
        
        for (const field of doseFields) {
          if (row[field]) {
            const doseStr = String(row[field]);
            const match = doseStr.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]*)/);
            if (match) {
              doseValue = parseFloat(match[1]);
              doseUnit = match[2] || '';
              break;
            }
          }
        }
        
        // Extract dose type/drug name
        const drugFields = ['drug', 'medicine', 'medication', 'treatment', 'name'];
        let drugName = 'Unknown';
        for (const field of drugFields) {
          if (row[field]) {
            drugName = String(row[field]);
            analysis.doseTypes.add(drugName);
            break;
          }
        }
        
        const doseRecord = {
          drug: drugName,
          dose: doseValue,
          unit: doseUnit,
          month: dateValue,
          rawData: row
        };
        
        if (isExternal) {
          analysis.externalDoses.push(doseRecord);
        } else if (isInternal) {
          analysis.internalDoses.push(doseRecord);
        }
      });
      
      analysis.doseTypes = Array.from(analysis.doseTypes);
      analysis.months = Array.from(analysis.months).sort();
      results.push(analysis);
    });
    
    return results;
  };

  // Analyze item cells data for dose types and monthly comparisons
  const analyzeItemCellsData = (files) => {
    const results = [];
    
    files.forEach(file => {
      if (!file.data || !Array.isArray(file.data)) return;
      
      const analysis = {
        fileName: file.name,
        itemsByMonth: {},
        doseTypes: new Set(),
        months: new Set(),
        totalsByType: {}
      };
      
      file.data.forEach(row => {
        // Extract date
        const dateFields = ['date', 'timestamp', 'month', 'period'];
        let monthKey = null;
        for (const field of dateFields) {
          if (row[field]) {
            const date = new Date(row[field]);
            if (!isNaN(date)) {
              monthKey = date.toISOString().slice(0, 7);
              analysis.months.add(monthKey);
              break;
            }
          }
        }
        
        // Extract item/dose type
        const itemFields = ['item', 'type', 'category', 'dose_type', 'drug'];
        let itemType = 'Unknown';
        for (const field of itemFields) {
          if (row[field]) {
            itemType = String(row[field]);
            analysis.doseTypes.add(itemType);
            break;
          }
        }
        
        // Extract quantity
        const qtyFields = ['quantity', 'count', 'amount', 'total'];
        let quantity = 0;
        for (const field of qtyFields) {
          if (row[field]) {
            const qtyValue = parseFloat(row[field]);
            if (!isNaN(qtyValue)) {
              quantity = qtyValue;
              break;
            }
          }
        }
        
        // Organize by month and type
        if (monthKey) {
          if (!analysis.itemsByMonth[monthKey]) {
            analysis.itemsByMonth[monthKey] = {};
          }
          if (!analysis.itemsByMonth[monthKey][itemType]) {
            analysis.itemsByMonth[monthKey][itemType] = 0;
          }
          analysis.itemsByMonth[monthKey][itemType] += quantity;
        }
        
        // Track totals by type
        if (!analysis.totalsByType[itemType]) {
          analysis.totalsByType[itemType] = 0;
        }
        analysis.totalsByType[itemType] += quantity;
      });
      
      analysis.doseTypes = Array.from(analysis.doseTypes);
      analysis.months = Array.from(analysis.months).sort();
      results.push(analysis);
    });
    
    return results;
  };

  const getSelectedFilesData = () => {
    return selectedFiles.map(id => 
      uploadedFiles.find(f => f.id === id)
    ).filter(Boolean);
  };

  // Render medicine analysis
  const renderMedicineAnalysis = () => {
    const selectedData = getSelectedFilesData();
    const analysis = analyzeMedicineData(selectedData);
    
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-center text-blue-600">🏥 Medicine Analysis - External vs Internal Doses</h3>
        
        {analysis.map(fileAnalysis => (
          <div key={fileAnalysis.fileName} className="border rounded-lg p-4 bg-white shadow">
            <h4 className="font-semibold mb-4 text-gray-800">{fileAnalysis.fileName}</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* External Doses */}
              <div className="border rounded p-3 bg-green-50">
                <h5 className="font-medium text-green-800 mb-2">🌿 External Doses ({fileAnalysis.externalDoses.length})</h5>
                {fileAnalysis.externalDoses.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {fileAnalysis.externalDoses.slice(0, 10).map((dose, idx) => (
                      <div key={idx} className="text-xs text-green-700">
                        {dose.drug}: {dose.dose} {dose.unit} {dose.month && `(${dose.month})`}
                      </div>
                    ))}
                    {fileAnalysis.externalDoses.length > 10 && (
                      <div className="text-xs text-green-600">...and {fileAnalysis.externalDoses.length - 10} more</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No external doses found</div>
                )}
              </div>
              
              {/* Internal Doses */}
              <div className="border rounded p-3 bg-blue-50">
                <h5 className="font-medium text-blue-800 mb-2">💉 Internal Doses ({fileAnalysis.internalDoses.length})</h5>
                {fileAnalysis.internalDoses.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {fileAnalysis.internalDoses.slice(0, 10).map((dose, idx) => (
                      <div key={idx} className="text-xs text-blue-700">
                        {dose.drug}: {dose.dose} {dose.unit} {dose.month && `(${dose.month})`}
                      </div>
                    ))}
                    {fileAnalysis.internalDoses.length > 10 && (
                      <div className="text-xs text-blue-600">...and {fileAnalysis.internalDoses.length - 10} more</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No internal doses found</div>
                )}
              </div>
            </div>
            
            {/* Summary comparison */}
            <div className="border-t pt-3">
              <h5 className="font-medium mb-2">📊 Comparison Summary</h5>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center p-2 bg-gray-100 rounded">
                  <div className="font-bold text-gray-700">{fileAnalysis.doseTypes.length}</div>
                  <div className="text-xs text-gray-600">Drug Types</div>
                </div>
                <div className="text-center p-2 bg-green-100 rounded">
                  <div className="font-bold text-green-700">{fileAnalysis.externalDoses.length}</div>
                  <div className="text-xs text-green-600">External</div>
                </div>
                <div className="text-center p-2 bg-blue-100 rounded">
                  <div className="font-bold text-blue-700">{fileAnalysis.internalDoses.length}</div>
                  <div className="text-xs text-blue-600">Internal</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render item cells analysis
  const renderItemCellsAnalysis = () => {
    const selectedData = getSelectedFilesData();
    const analysis = analyzeItemCellsData(selectedData);
    
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-center text-purple-600">📦 Item Cells Analysis - Dose Types by Month</h3>
        
        {analysis.map(fileAnalysis => (
          <div key={fileAnalysis.fileName} className="border rounded-lg p-4 bg-white shadow">
            <h4 className="font-semibold mb-4 text-gray-800">{fileAnalysis.fileName}</h4>
            
            {/* Monthly breakdown table */}
            {fileAnalysis.months.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <h5 className="font-medium mb-2">📅 Monthly Breakdown by Dose Type</h5>
                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-purple-100">
                    <tr>
                      <th className="border border-gray-300 px-2 py-1 text-left">Month</th>
                      {fileAnalysis.doseTypes.map(type => (
                        <th key={type} className="border border-gray-300 px-2 py-1 text-center">{type}</th>
                      ))}
                      <th className="border border-gray-300 px-2 py-1 text-center font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileAnalysis.months.map(month => {
                      const monthData = fileAnalysis.itemsByMonth[month] || {};
                      const monthTotal = Object.values(monthData).reduce((sum, val) => sum + val, 0);
                      
                      return (
                        <tr key={month} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1 font-medium">{month}</td>
                          {fileAnalysis.doseTypes.map(type => (
                            <td key={type} className="border border-gray-300 px-2 py-1 text-center">
                              {monthData[type] || 0}
                            </td>
                          ))}
                          <td className="border border-gray-300 px-2 py-1 text-center font-bold bg-purple-50">
                            {monthTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Dose type totals */}
            <div className="border-t pt-3">
              <h5 className="font-medium mb-2">📈 Total by Dose Type</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(fileAnalysis.totalsByType).map(([type, total]) => (
                  <div key={type} className="text-center p-2 bg-purple-100 rounded">
                    <div className="font-bold text-purple-700">{total}</div>
                    <div className="text-xs text-purple-600">{type}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFileContent = (file) => {
    if (!file.data || !Array.isArray(file.data) || file.data.length === 0) {
      return <div className="text-gray-500 p-4">No data to display</div>;
    }

    const keys = Object.keys(file.data[0] || {});
    const displayData = file.data.slice(0, 50); // Show first 50 records

    return (
      <div className="overflow-auto max-h-96">
        <table className="min-w-full border-collapse border border-gray-300 text-sm">
          <thead className="bg-gray-100">
            <tr>
              {keys.map(key => (
                <th key={key} className="border border-gray-300 px-2 py-1 text-left">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {keys.map(key => (
                  <td key={key} className="border border-gray-300 px-2 py-1">
                    {String(row[key] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {file.data.length > 50 && (
          <div className="text-center text-gray-500 mt-2">
            Showing first 50 of {file.data.length} records
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-4">File Upload & Comparison</h2>
      
      {/* Upload Section */}
      <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <div className="text-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mb-2"
          >
            📁 Upload Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,.csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
          />
          <p className="text-sm text-gray-600">
            Supports: JSON, CSV, Excel files (.xlsx, .xls)
          </p>
        </div>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Uploaded Files ({uploadedFiles.length})</h3>
          <div className="space-y-2">
            {uploadedFiles.map(file => (
              <div 
                key={file.id} 
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedFiles.includes(file.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => toggleFileSelection(file.id)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {file.name}
                      {file.contentType === 'medicine' && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">MEDICINE</span>}
                      {file.contentType === 'itemcells' && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">ITEM CELLS</span>}
                    </div>
                    <div className="text-sm text-gray-600">
                      {file.type.toUpperCase()} • {file.recordCount} records • {(file.size / 1024).toFixed(1)} KB • {file.uploadDate}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedFiles.includes(file.id) && (
                      <span className="text-blue-600 text-sm font-medium">Selected</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                      className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compare Controls */}
      {selectedFiles.length > 0 && (
        <div className="mb-6 text-center space-y-4">
          <div>
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`px-6 py-3 rounded-lg font-medium ${
                compareMode 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {compareMode ? '📄 View Individual Files' : '🔍 Compare Selected Files'}
            </button>
            <p className="text-sm text-gray-600 mt-2">
              {selectedFiles.length} file(s) selected for comparison
            </p>
          </div>
          
          {/* Analysis Mode Controls */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Analysis Mode:</h4>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setAnalysisMode('basic')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  analysisMode === 'basic'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📋 Basic View
              </button>
              <button
                onClick={() => setAnalysisMode('medicine')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  analysisMode === 'medicine'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-200 text-blue-700 hover:bg-blue-300'
                }`}
              >
                🏥 Medicine Analysis
              </button>
              <button
                onClick={() => setAnalysisMode('itemcells')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  analysisMode === 'itemcells'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-200 text-purple-700 hover:bg-purple-300'
                }`}
              >
                📦 Item Cells Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Content Display */}
      {selectedFiles.length > 0 && (
        <div>
          {analysisMode === 'medicine' ? (
            renderMedicineAnalysis()
          ) : analysisMode === 'itemcells' ? (
            renderItemCellsAnalysis()
          ) : compareMode && selectedFiles.length > 1 ? (
            // Side-by-side comparison (basic mode)
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getSelectedFilesData().map(file => (
                <div key={file.id} className="border rounded-lg">
                  <div className="bg-gray-100 p-3 font-medium border-b">
                    {file.name} ({file.recordCount} records)
                  </div>
                  {renderFileContent(file)}
                </div>
              ))}
            </div>
          ) : (
            // Individual file view (basic mode)
            <div className="space-y-6">
              {getSelectedFilesData().map(file => (
                <div key={file.id} className="border rounded-lg">
                  <div className="bg-gray-100 p-3 font-medium border-b">
                    {file.name} ({file.recordCount} records)
                  </div>
                  {renderFileContent(file)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {uploadedFiles.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg">No files uploaded yet</p>
          <p className="text-sm">Upload some files to view and compare data</p>
        </div>
      )}
    </div>
  );
};

export default FileComparison;