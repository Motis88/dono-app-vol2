import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const FileComparison = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
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
          const newFile = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            type: fileType,
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

  const getSelectedFilesData = () => {
    return selectedFiles.map(id => 
      uploadedFiles.find(f => f.id === id)
    ).filter(Boolean);
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
                    <div className="font-medium">{file.name}</div>
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
        <div className="mb-6 text-center">
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
      )}

      {/* File Content Display */}
      {selectedFiles.length > 0 && (
        <div>
          {compareMode && selectedFiles.length > 1 ? (
            // Side-by-side comparison
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
            // Individual file view
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