import React, { useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { processUploadedFile, HEBREW_LABELS, SUPPORTED_FILE_TYPES } from '../utils/fileParser';

const ProductComparison = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [mergedData, setMergedData] = useState([]);
  const [view, setView] = useState('upload'); // 'upload', 'data', 'monthComparison', 'productComparison'
  const [locale, setLocale] = useState('en'); // 'en', 'he'
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Get label text based on locale
  const getLabel = (key, fallback = key) => {
    if (locale === 'he') {
      const hebrewLabels = {
        ...HEBREW_LABELS,
        fileUploadComparison: 'העלאת קבצים והשוואת מוצרים',
        upload: 'העלאה',
        data: 'נתונים',
        monthComparison: 'השוואת חודשים',
        productComparison: 'השוואת מוצרים',
        uploadFiles: 'העלאת קבצים',
        supportedFormats: 'פורמטים נתמכים',
        requiredFields: 'שדות נדרשים',
        uploadedFiles: 'קבצים שהועלו',
        products: 'מוצרים',
        months: 'חודשים',
        totalRevenue: 'הכנסה כוללת',
        uploaded: 'הועלה',
        duplicatesRemoved: 'כפילויות הוסרו',
        selected: 'נבחר',
        dismiss: 'סגור',
        filterByMonth: 'סנן לפי חודש',
        allMonths: 'כל החודשים',
        filterByProduct: 'סנן לפי מוצר',
        sortBy: 'מיין לפי',
        direction: 'כיוון',
        ascending: 'עולה',
        descending: 'יורד',
        showing: 'מציג',
        showingFirst: 'מציג ראשונים',
        of: 'מתוך',
        monthlyTrends: 'מגמות חודשיות',
        topProducts: 'מוצרים מובילים לפי הכנסה',
        noFilesUploaded: 'לא הועלו קבצים עדיין',
        uploadFilesToStart: 'העלה קבצים כדי להתחיל להשוות נתונים',
        goToUpload: 'עבור להעלאה'
      };
      return hebrewLabels[key] || fallback;
    }
    return fallback;
  };

  // Process file upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    setError('');
    
    for (const file of files) {
      try {
        const result = await processUploadedFile(file);
        
        if (result.success) {
          const newFile = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            uploadDate: new Date().toLocaleString(),
            data: result.data,
            summary: result.summary,
            validation: result.validation
          };
          
          setUploadedFiles(prev => [...prev, newFile]);
          setSelectedFiles(prev => [...prev, newFile.id]);
        } else {
          setError(prev => prev ? `${prev}; ${result.error}` : result.error);
        }
      } catch (error) {
        console.error('File processing error:', error);
        setError(prev => prev ? `${prev}; Error processing ${file.name}` : `Error processing ${file.name}`);
      }
    }
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove file
  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setSelectedFiles(prev => prev.filter(id => id !== fileId));
  };

  // Toggle file selection
  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  };

  // Merge selected files data
  const mergeSelectedData = () => {
    const selectedFilesData = uploadedFiles.filter(f => selectedFiles.includes(f.id));
    const allData = selectedFilesData.flatMap(f => f.data);
    
    // Sort and filter merged data
    let filtered = allData.filter(row => {
      const monthMatch = !filterMonth || row.month === filterMonth;
      const productMatch = !filterProduct || row.productName.toLowerCase().includes(filterProduct.toLowerCase());
      return monthMatch && productMatch;
    });

    // Sort data
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortDirection === 'asc' ? 1 : -1;
      
      if (sortField === 'date') {
        return modifier * (new Date(aVal) - new Date(bVal));
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        return modifier * (aVal - bVal);
      } else {
        return modifier * String(aVal).localeCompare(String(bVal));
      }
    });

    setMergedData(filtered);
  };

  // Get unique months and products for filtering
  const getUniqueValues = (field) => {
    const allData = uploadedFiles.flatMap(f => f.data);
    return [...new Set(allData.map(row => row[field]).filter(Boolean))].sort();
  };

  // Generate month comparison data
  const getMonthComparisonData = () => {
    const allData = uploadedFiles.flatMap(f => f.data);
    const monthData = {};

    allData.forEach(row => {
      if (!row.month) return;
      
      if (!monthData[row.month]) {
        monthData[row.month] = {
          month: row.month,
          totalQuantity: 0,
          totalRevenue: 0,
          uniqueProducts: new Set(),
          products: {}
        };
      }
      
      monthData[row.month].totalQuantity += row.quantity;
      monthData[row.month].totalRevenue += row.total;
      monthData[row.month].uniqueProducts.add(row.productName);
      
      if (!monthData[row.month].products[row.productName]) {
        monthData[row.month].products[row.productName] = { quantity: 0, revenue: 0 };
      }
      monthData[row.month].products[row.productName].quantity += row.quantity;
      monthData[row.month].products[row.productName].revenue += row.total;
    });

    return Object.values(monthData).map(data => ({
      ...data,
      uniqueProducts: data.uniqueProducts.size
    })).sort((a, b) => a.month.localeCompare(b.month));
  };

  // Generate product comparison data
  const getProductComparisonData = () => {
    const allData = uploadedFiles.flatMap(f => f.data);
    const productData = {};

    allData.forEach(row => {
      if (!productData[row.productName]) {
        productData[row.productName] = {
          productName: row.productName,
          totalQuantity: 0,
          totalRevenue: 0,
          monthsActive: new Set(),
          months: {}
        };
      }
      
      productData[row.productName].totalQuantity += row.quantity;
      productData[row.productName].totalRevenue += row.total;
      productData[row.productName].monthsActive.add(row.month);
      
      if (!productData[row.productName].months[row.month]) {
        productData[row.productName].months[row.month] = { quantity: 0, revenue: 0 };
      }
      productData[row.productName].months[row.month].quantity += row.quantity;
      productData[row.productName].months[row.month].revenue += row.total;
    });

    return Object.values(productData).map(data => ({
      ...data,
      monthsActive: data.monthsActive.size
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  };

  // Get overall summary
  const getOverallSummary = () => {
    const allData = uploadedFiles.flatMap(f => f.data);
    return {
      totalFiles: uploadedFiles.length,
      totalRecords: allData.length,
      totalQuantity: allData.reduce((sum, row) => sum + row.quantity, 0),
      totalRevenue: allData.reduce((sum, row) => sum + row.total, 0),
      uniqueProducts: new Set(allData.map(row => row.productName)).size,
      monthsSpanned: new Set(allData.map(row => row.month).filter(Boolean)).size
    };
  };

  // Update merged data when filters change
  React.useEffect(() => {
    if (selectedFiles.length > 0) {
      mergeSelectedData();
    }
  }, [selectedFiles, sortField, sortDirection, filterMonth, filterProduct, uploadedFiles]);

  const isRTL = locale === 'he';

  return (
    <div className={`p-4 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-center">
          {getLabel('fileUploadComparison', 'File Upload & Product Comparison')}
        </h2>
        
        {/* Locale Toggle */}
        <button
          onClick={() => setLocale(prev => prev === 'en' ? 'he' : 'en')}
          className="px-3 py-1 bg-gray-200 rounded text-sm"
        >
          {locale === 'en' ? 'עברית' : 'English'}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {[
          { key: 'upload', label: getLabel('upload', 'Upload'), icon: '📁' },
          { key: 'data', label: getLabel('data', 'Data'), icon: '📊' },
          { key: 'monthComparison', label: getLabel('monthComparison', 'Month Comparison'), icon: '📅' },
          { key: 'productComparison', label: getLabel('productComparison', 'Product Comparison'), icon: '🏷️' }
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-4 py-2 rounded font-medium ${
              view === key 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p className="font-bold">{getLabel('error', 'Error')}:</p>
          <p>{error}</p>
          <button 
            onClick={() => setError('')}
            className="mt-2 text-sm underline"
          >
            {getLabel('dismiss', 'Dismiss')}
          </button>
        </div>
      )}

      {/* Upload View */}
      {view === 'upload' && (
        <div>
          {/* Upload Section */}
          <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <div className="text-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mb-2"
              >
                📁 {getLabel('uploadFiles', 'Upload Files')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={SUPPORTED_FILE_TYPES.join(',')}
                className="hidden"
                onChange={handleFileUpload}
              />
              <p className="text-sm text-gray-600">
                {getLabel('supportedFormats', 'Supports')}: {SUPPORTED_FILE_TYPES.join(', ')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {getLabel('requiredFields', 'Required fields')}: date, productName, quantity, price
              </p>
            </div>
          </div>

          {/* Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">
                {getLabel('uploadedFiles', 'Uploaded Files')} ({uploadedFiles.length})
              </h3>
              
              {uploadedFiles.map(file => (
                <div 
                  key={file.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedFiles.includes(file.id) 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => toggleFileSelection(file.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{file.name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {file.summary.recordCount} {getLabel('records', 'records')} • 
                        {file.summary.uniqueProducts} {getLabel('products', 'products')} • 
                        {file.summary.monthsSpanned} {getLabel('months', 'months')} • 
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {getLabel('totalRevenue', 'Total Revenue')}: {file.summary.totalRevenue.toFixed(2)} • 
                        {getLabel('uploaded', 'Uploaded')}: {file.uploadDate}
                      </div>
                      {file.summary.duplicatesRemoved > 0 && (
                        <div className="text-xs text-orange-600 mt-1">
                          {file.summary.duplicatesRemoved} {getLabel('duplicatesRemoved', 'duplicates removed')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {selectedFiles.includes(file.id) && (
                        <span className="text-blue-600 text-sm font-medium">
                          {getLabel('selected', 'Selected')}
                        </span>
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

              {/* Overall Summary */}
              {uploadedFiles.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold mb-2">{getLabel('summary', 'Summary')}</h4>
                  {(() => {
                    const summary = getOverallSummary();
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-lg">{summary.totalFiles}</div>
                          <div className="text-gray-600">{getLabel('files', 'Files')}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{summary.totalRecords}</div>
                          <div className="text-gray-600">{getLabel('records', 'Records')}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{summary.uniqueProducts}</div>
                          <div className="text-gray-600">{getLabel('products', 'Products')}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{summary.totalQuantity}</div>
                          <div className="text-gray-600">{getLabel('quantity', 'Quantity')}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{summary.totalRevenue.toFixed(2)}</div>
                          <div className="text-gray-600">{getLabel('revenue', 'Revenue')}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{summary.monthsSpanned}</div>
                          <div className="text-gray-600">{getLabel('months', 'Months')}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Data View */}
      {view === 'data' && selectedFiles.length > 0 && (
        <div>
          {/* Filters and Sorting */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {getLabel('filterByMonth', 'Filter by Month')}
                </label>
                <select 
                  value={filterMonth} 
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">{getLabel('allMonths', 'All Months')}</option>
                  {getUniqueValues('month').map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  {getLabel('filterByProduct', 'Filter by Product')}
                </label>
                <input
                  type="text"
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  placeholder={getLabel('productName', 'Product name...')}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  {getLabel('sortBy', 'Sort by')}
                </label>
                <select 
                  value={sortField} 
                  onChange={(e) => setSortField(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="date">{getLabel('date', 'Date')}</option>
                  <option value="productName">{getLabel('productName', 'Product')}</option>
                  <option value="quantity">{getLabel('quantity', 'Quantity')}</option>
                  <option value="price">{getLabel('price', 'Price')}</option>
                  <option value="total">{getLabel('total', 'Total')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  {getLabel('direction', 'Direction')}
                </label>
                <select 
                  value={sortDirection} 
                  onChange={(e) => setSortDirection(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="asc">{getLabel('ascending', 'Ascending')}</option>
                  <option value="desc">{getLabel('descending', 'Descending')}</option>
                </select>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              {getLabel('showing', 'Showing')} {mergedData.length} {getLabel('records', 'records')}
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left border-b">{getLabel('date', 'Date')}</th>
                  <th className="px-4 py-2 text-left border-b">{getLabel('month', 'Month')}</th>
                  <th className="px-4 py-2 text-left border-b">{getLabel('productName', 'Product')}</th>
                  <th className="px-4 py-2 text-right border-b">{getLabel('quantity', 'Quantity')}</th>
                  <th className="px-4 py-2 text-right border-b">{getLabel('price', 'Price')}</th>
                  <th className="px-4 py-2 text-right border-b">{getLabel('total', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {mergedData.slice(0, 100).map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b">{row.date}</td>
                    <td className="px-4 py-2 border-b">{row.month}</td>
                    <td className="px-4 py-2 border-b">{row.productName}</td>
                    <td className="px-4 py-2 border-b text-right">{row.quantity}</td>
                    <td className="px-4 py-2 border-b text-right">{row.price.toFixed(2)}</td>
                    <td className="px-4 py-2 border-b text-right">{row.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mergedData.length > 100 && (
              <div className="p-4 text-center text-gray-500">
                {getLabel('showingFirst', 'Showing first')} 100 {getLabel('of', 'of')} {mergedData.length} {getLabel('records', 'records')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Month Comparison View */}
      {view === 'monthComparison' && selectedFiles.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-center">
            {getLabel('monthComparison', 'Monthly Comparison')}
          </h3>
          
          {(() => {
            const monthData = getMonthComparisonData();
            return (
              <div>
                {/* Chart */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                  <h4 className="font-semibold mb-4">{getLabel('monthlyTrends', 'Monthly Trends')}</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthData}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalQuantity" fill="#60a5fa" name={getLabel('quantity', 'Quantity')} />
                      <Bar dataKey="totalRevenue" fill="#34d399" name={getLabel('revenue', 'Revenue')} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left border-b">{getLabel('month', 'Month')}</th>
                        <th className="px-4 py-2 text-right border-b">{getLabel('quantity', 'Quantity')}</th>
                        <th className="px-4 py-2 text-right border-b">{getLabel('revenue', 'Revenue')}</th>
                        <th className="px-4 py-2 text-right border-b">{getLabel('products', 'Products')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 border-b font-medium">{row.month}</td>
                          <td className="px-4 py-2 border-b text-right">{row.totalQuantity}</td>
                          <td className="px-4 py-2 border-b text-right">{row.totalRevenue.toFixed(2)}</td>
                          <td className="px-4 py-2 border-b text-right">{row.uniqueProducts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Product Comparison View */}
      {view === 'productComparison' && selectedFiles.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-center">
            {getLabel('productComparison', 'Product Comparison')}
          </h3>
          
          {(() => {
            const productData = getProductComparisonData();
            return (
              <div>
                {/* Chart */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                  <h4 className="font-semibold mb-4">{getLabel('topProducts', 'Top Products by Revenue')}</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={productData.slice(0, 10)}>
                      <XAxis dataKey="productName" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="totalRevenue" fill="#f472b6" name={getLabel('revenue', 'Revenue')} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left border-b">{getLabel('productName', 'Product')}</th>
                        <th className="px-4 py-2 text-right border-b">{getLabel('quantity', 'Quantity')}</th>
                        <th className="px-4 py-2 text-right border-b">{getLabel('revenue', 'Revenue')}</th>
                        <th className="px-4 py-2 text-right border-b">{getLabel('months', 'Months')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 border-b font-medium">{row.productName}</td>
                          <td className="px-4 py-2 border-b text-right">{row.totalQuantity}</td>
                          <td className="px-4 py-2 border-b text-right">{row.totalRevenue.toFixed(2)}</td>
                          <td className="px-4 py-2 border-b text-right">{row.monthsActive}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Empty State */}
      {uploadedFiles.length === 0 && view !== 'upload' && (
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg">{getLabel('noFilesUploaded', 'No files uploaded yet')}</p>
          <p className="text-sm">{getLabel('uploadFilesToStart', 'Upload some files to start comparing data')}</p>
          <button
            onClick={() => setView('upload')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {getLabel('goToUpload', 'Go to Upload')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductComparison;