/**
 * Cloud Backup Utilities
 * Google Drive integration for automatic backups
 */

const CLOUD_BACKUP_KEY = 'cloud_backup_settings';
const GOOGLE_CLIENT_ID = ''; // Will be configured by user
const GOOGLE_API_KEY = ''; // Will be configured by user
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FOLDER_NAME = 'DonoApp Backups';

/**
 * Cloud backup settings structure
 */
export const DEFAULT_CLOUD_SETTINGS = {
  enabled: false,
  provider: 'google', // 'google' or 'dropbox'
  frequency: 'daily', // 'daily', 'weekly', 'manual'
  lastCloudBackup: null,
  autoBackupCount: 0,
  folderPath: BACKUP_FOLDER_NAME,
  keepLastN: 10, // Keep last 10 backups
  isAuthenticated: false,
  googleClientId: '',
  googleApiKey: '',
};

/**
 * Get cloud backup settings from localStorage
 */
export const getCloudBackupSettings = () => {
  try {
    const saved = localStorage.getItem(CLOUD_BACKUP_KEY);
    if (saved) {
      return { ...DEFAULT_CLOUD_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading cloud backup settings:', e);
  }
  return DEFAULT_CLOUD_SETTINGS;
};

/**
 * Save cloud backup settings to localStorage
 */
export const saveCloudBackupSettings = (settings) => {
  try {
    localStorage.setItem(CLOUD_BACKUP_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error('Error saving cloud backup settings:', e);
    return false;
  }
};

/**
 * Check if cloud backup is due based on frequency
 */
export const isCloudBackupDue = () => {
  const settings = getCloudBackupSettings();
  
  if (!settings.enabled || !settings.isAuthenticated) {
    return false;
  }
  
  if (!settings.lastCloudBackup) {
    return true; // Never backed up
  }
  
  const lastBackup = new Date(settings.lastCloudBackup);
  const now = new Date();
  const hoursSinceBackup = (now - lastBackup) / (1000 * 60 * 60);
  
  switch (settings.frequency) {
    case 'daily':
      return hoursSinceBackup >= 24;
    case 'weekly':
      return hoursSinceBackup >= 168; // 7 days
    default:
      return false; // Manual only
  }
};

/**
 * Initialize Google Drive API (client-side)
 * This is a simplified version - full implementation requires Google Sign-In
 */
export const initGoogleDrive = async (clientId, apiKey) => {
  try {
    // Check if gapi is loaded
    if (typeof window.gapi === 'undefined') {
      console.warn('Google API not loaded. Please include the script in index.html');
      return false;
    }
    
    // Load the client library
    await new Promise((resolve, reject) => {
      window.gapi.load('client:auth2', {
        callback: resolve,
        onerror: reject
      });
    });
    
    // Initialize the client
    await window.gapi.client.init({
      apiKey: apiKey,
      clientId: clientId,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      scope: GOOGLE_SCOPES,
    });
    
    return true;
  } catch (error) {
    console.error('Error initializing Google Drive:', error);
    return false;
  }
};

/**
 * Sign in to Google Drive
 */
export const signInToGoogleDrive = async () => {
  try {
    if (typeof window.gapi === 'undefined' || !window.gapi.auth2) {
      throw new Error('Google API not initialized');
    }
    
    const auth2 = window.gapi.auth2.getAuthInstance();
    await auth2.signIn();
    
    return auth2.isSignedIn.get();
  } catch (error) {
    console.error('Error signing in to Google Drive:', error);
    return false;
  }
};

/**
 * Sign out from Google Drive
 */
export const signOutFromGoogleDrive = async () => {
  try {
    if (typeof window.gapi === 'undefined' || !window.gapi.auth2) {
      return true;
    }
    
    const auth2 = window.gapi.auth2.getAuthInstance();
    await auth2.signOut();
    
    return true;
  } catch (error) {
    console.error('Error signing out from Google Drive:', error);
    return false;
  }
};

/**
 * Upload backup to Google Drive
 */
export const uploadToGoogleDrive = async (fileName, jsonData) => {
  try {
    if (typeof window.gapi === 'undefined' || !window.gapi.client) {
      throw new Error('Google API not initialized');
    }
    
    // Convert data to blob
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    
    // Create file metadata
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: await getOrCreateBackupFolder(),
    };
    
    // Create form data
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);
    
    // Upload to Google Drive
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: new Headers({
        'Authorization': `Bearer ${window.gapi.auth.getToken().access_token}`
      }),
      body: form,
    });
    
    const result = await response.json();
    
    if (result.id) {
      // Update last backup time
      const settings = getCloudBackupSettings();
      settings.lastCloudBackup = new Date().toISOString();
      settings.autoBackupCount++;
      saveCloudBackupSettings(settings);
      
      return { success: true, fileId: result.id, fileName: result.name };
    }
    
    return { success: false, error: 'Upload failed' };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get or create backup folder in Google Drive
 */
const getOrCreateBackupFolder = async () => {
  try {
    // Search for existing folder
    const response = await window.gapi.client.drive.files.list({
      q: `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });
    
    if (response.result.files && response.result.files.length > 0) {
      return [response.result.files[0].id];
    }
    
    // Create folder if not exists
    const folderMetadata = {
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    };
    
    const folder = await window.gapi.client.drive.files.create({
      resource: folderMetadata,
      fields: 'id',
    });
    
    return [folder.result.id];
  } catch (error) {
    console.error('Error getting/creating backup folder:', error);
    return [];
  }
};

/**
 * List backups in Google Drive
 */
export const listGoogleDriveBackups = async () => {
  try {
    if (typeof window.gapi === 'undefined' || !window.gapi.client) {
      throw new Error('Google API not initialized');
    }
    
    const folderId = await getOrCreateBackupFolder();
    
    const response = await window.gapi.client.drive.files.list({
      q: `'${folderId[0]}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime, size)',
      orderBy: 'createdTime desc',
      pageSize: 20,
    });
    
    return response.result.files || [];
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
};

/**
 * Download backup from Google Drive
 */
export const downloadFromGoogleDrive = async (fileId) => {
  try {
    if (typeof window.gapi === 'undefined' || !window.gapi.client) {
      throw new Error('Google API not initialized');
    }
    
    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });
    
    return JSON.parse(response.body);
  } catch (error) {
    console.error('Error downloading from Google Drive:', error);
    return null;
  }
};

/**
 * Delete old backups to keep only last N
 */
export const cleanupOldBackups = async (keepLastN = 10) => {
  try {
    const backups = await listGoogleDriveBackups();
    
    if (backups.length <= keepLastN) {
      return { deleted: 0, kept: backups.length };
    }
    
    const toDelete = backups.slice(keepLastN);
    let deletedCount = 0;
    
    for (const backup of toDelete) {
      try {
        await window.gapi.client.drive.files.delete({
          fileId: backup.id,
        });
        deletedCount++;
      } catch (err) {
        console.error('Error deleting backup:', backup.name, err);
      }
    }
    
    return { deleted: deletedCount, kept: keepLastN };
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
    return { deleted: 0, kept: 0 };
  }
};

/**
 * Perform automatic backup if due
 */
export const performAutoBackup = async () => {
  const settings = getCloudBackupSettings();
  
  if (!settings.enabled || !settings.isAuthenticated) {
    return { success: false, reason: 'Not enabled or not authenticated' };
  }
  
  if (!isCloudBackupDue()) {
    return { success: false, reason: 'Backup not due yet' };
  }
  
  try {
    // Gather all data
    const donors = JSON.parse(localStorage.getItem('animal_donors') || '[]');
    const inventory = JSON.parse(localStorage.getItem('blood_inventory') || '{}');
    const financial = JSON.parse(localStorage.getItem('financial_data') || '{}');
    
    const backupData = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      data: {
        donors,
        inventory,
        financial,
      },
    };
    
    const fileName = `dono-backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
    const result = await uploadToGoogleDrive(fileName, backupData);
    
    if (result.success) {
      // Clean up old backups
      await cleanupOldBackups(settings.keepLastN);
    }
    
    return result;
  } catch (error) {
    console.error('Error performing auto backup:', error);
    return { success: false, error: error.message };
  }
};
