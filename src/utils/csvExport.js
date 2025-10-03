/**
 * Export donors data to CSV format
 * @param {Array} donors - Array of donor objects
 * @returns {string} CSV formatted string
 */
export const donorsToCSV = (donors) => {
  if (!Array.isArray(donors) || donors.length === 0) {
    return '';
  }

  // Define CSV headers (all possible fields)
  const headers = [
    'ID',
    'Date',
    'Location',
    'Animal Name',
    'Age',
    'Weight',
    'Gender',
    'Animal Type',
    'Blood Type',
    'FIV Status',
    'FeLV Status',
    'PCV',
    'HCT',
    'WBC',
    'PLT',
    'Packed Cell',
    'Slide Findings',
    'Donated',
    'Volume',
    'Notes',
    'Private Owner',
    'Owner Name',
    'File Number',
    'Owner Phone'
  ];

  // Helper to escape CSV values
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV rows
  const rows = donors.map(donor => [
    escapeCSV(donor.id || ''),
    escapeCSV(donor.date || ''),
    escapeCSV(donor.location || ''),
    escapeCSV(donor.animalName || ''),
    escapeCSV(donor.age || ''),
    escapeCSV(donor.weight || ''),
    escapeCSV(donor.gender || ''),
    escapeCSV(donor.animalType || ''),
    escapeCSV(donor.bloodType || ''),
    escapeCSV(donor.fiv || ''),
    escapeCSV(donor.felv || ''),
    escapeCSV(donor.pcv || ''),
    escapeCSV(donor.hct || ''),
    escapeCSV(donor.wbc || ''),
    escapeCSV(donor.plt || ''),
    escapeCSV(donor.packedCell || ''),
    escapeCSV(donor.slideFindings || ''),
    escapeCSV(donor.donated || ''),
    escapeCSV(donor.volume || ''),
    escapeCSV(donor.notes || ''),
    escapeCSV(donor.isPrivateOwner ? 'Yes' : 'No'),
    escapeCSV(donor.ownerName || ''),
    escapeCSV(donor.fileNumber || ''),
    escapeCSV(donor.ownerPhone || '')
  ].join(','));

  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n');
};

/**
 * Download CSV file (works on mobile via Capacitor and web via blob download)
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Filename for download
 */
export const downloadCSV = async (csvContent, filename) => {
  // Create BOM for UTF-8 to ensure proper encoding in Excel
  const BOM = '\uFEFF';
  const fullContent = BOM + csvContent;

  // Check if running on Capacitor (mobile)
  const { Capacitor } = await import('@capacitor/core');
  
  if (Capacitor.isNativePlatform()) {
    // Mobile: Use Capacitor Filesystem and Share APIs
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

      // Write file to cache directory
      const result = await Filesystem.writeFile({
        path: filename,
        data: btoa(unescape(encodeURIComponent(fullContent))), // Base64 encode
        directory: Directory.Cache
      });

      // Share the file
      await Share.share({
        title: 'Export Donor Data',
        text: 'Donor data CSV file',
        url: result.uri,
        dialogTitle: 'Save or Share CSV File'
      });

      return true;
    } catch (error) {
      console.error('Error saving/sharing CSV on mobile:', error);
      alert('❌ Failed to export CSV: ' + error.message);
      return false;
    }
  } else {
    // Web: Use blob download
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }
};
