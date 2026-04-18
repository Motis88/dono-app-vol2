/**
 * Auto Backup System
 * Automated backup scheduling and management
 */

const AUTO_BACKUP_KEY = 'auto_backup_settings';
const BACKUP_SCHEDULE_KEY = 'backup_schedule';

/**
 * Default auto-backup settings
 */
const DEFAULT_SETTINGS = {
  enabled: false,
  frequency: 7, // days
  lastBackup: null,
  autoBackupCount: 0,
  notifications: true,
};

/**
 * Get auto-backup settings
 * @returns {Object} Current settings
 */
export const getAutoBackupSettings = () => {
  try {
    const saved = localStorage.getItem(AUTO_BACKUP_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading auto-backup settings:', e);
  }
  return DEFAULT_SETTINGS;
};

/**
 * Save auto-backup settings
 * @param {Object} settings - Settings to save
 */
export const saveAutoBackupSettings = (settings) => {
  try {
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving auto-backup settings:', e);
  }
};

/**
 * Check if auto-backup is due
 * @returns {boolean} True if backup needed
 */
export const isBackupDue = () => {
  const settings = getAutoBackupSettings();
  
  if (!settings.enabled) return false;
  if (!settings.lastBackup) return true;

  const lastBackupDate = new Date(settings.lastBackup);
  const now = new Date();
  const daysSince = Math.floor((now - lastBackupDate) / (1000 * 60 * 60 * 24));

  return daysSince >= settings.frequency;
};

/**
 * Record backup completion
 */
export const recordBackup = () => {
  const settings = getAutoBackupSettings();
  settings.lastBackup = new Date().toISOString();
  settings.autoBackupCount = (settings.autoBackupCount || 0) + 1;
  saveAutoBackupSettings(settings);
  
  // Also update the global last_backup_time
  localStorage.setItem('last_backup_time', settings.lastBackup);
};

/**
 * Schedule next auto-backup check
 * @param {Function} backupFunction - Function to call for backup
 * @returns {Function} Cleanup function
 */
export const scheduleAutoBackup = (backupFunction) => {
  const checkInterval = 60 * 60 * 1000; // Check every hour

  const check = async () => {
    if (isBackupDue()) {
      console.log('Auto-backup is due, initiating backup...');
      try {
        await backupFunction(false); // Silent backup
        recordBackup();
        console.log('Auto-backup completed successfully');
      } catch (error) {
        console.error('Auto-backup failed:', error);
      }
    }
  };

  // Initial check after 5 minutes
  const initialTimeout = setTimeout(check, 5 * 60 * 1000);

  // Periodic checks
  const interval = setInterval(check, checkInterval);

  // Return cleanup function
  return () => {
    clearTimeout(initialTimeout);
    clearInterval(interval);
  };
};

/**
 * Enable auto-backup with specific frequency
 * @param {number} days - Frequency in days
 */
export const enableAutoBackup = (days = 7) => {
  const settings = getAutoBackupSettings();
  settings.enabled = true;
  settings.frequency = days;
  saveAutoBackupSettings(settings);
};

/**
 * Disable auto-backup
 */
export const disableAutoBackup = () => {
  const settings = getAutoBackupSettings();
  settings.enabled = false;
  saveAutoBackupSettings(settings);
};

/**
 * Get backup statistics
 * @returns {Object} Backup stats
 */
export const getBackupStats = () => {
  const settings = getAutoBackupSettings();
  const lastBackup = settings.lastBackup ? new Date(settings.lastBackup) : null;
  const now = new Date();
  
  let daysSinceBackup = null;
  let daysUntilNext = null;
  
  if (lastBackup) {
    daysSinceBackup = Math.floor((now - lastBackup) / (1000 * 60 * 60 * 24));
    daysUntilNext = settings.frequency - daysSinceBackup;
  }

  return {
    enabled: settings.enabled,
    frequency: settings.frequency,
    lastBackup: settings.lastBackup,
    daysSinceBackup,
    daysUntilNext: daysUntilNext > 0 ? daysUntilNext : 0,
    autoBackupCount: settings.autoBackupCount || 0,
    isOverdue: daysSinceBackup !== null && daysSinceBackup > settings.frequency,
  };
};

export default {
  getAutoBackupSettings,
  saveAutoBackupSettings,
  isBackupDue,
  recordBackup,
  scheduleAutoBackup,
  enableAutoBackup,
  disableAutoBackup,
  getBackupStats,
};
