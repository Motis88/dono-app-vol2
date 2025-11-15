import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
  getCloudBackupSettings,
  saveCloudBackupSettings,
  initGoogleDrive,
  signInToGoogleDrive,
  signOutFromGoogleDrive,
  uploadToGoogleDrive,
  listGoogleDriveBackups,
  downloadFromGoogleDrive,
  performAutoBackup,
  isCloudBackupDue,
} from '../utils/cloudBackupUtils';

const CloudBackupManager = () => {
  const { colors } = useTheme();
  const [settings, setSettings] = useState(getCloudBackupSettings());
  const [isLoading, setIsLoading] = useState(false);
  const [backupList, setBackupList] = useState([]);
  const [showSetup, setShowSetup] = useState(false);
  const [credentials, setCredentials] = useState({
    clientId: settings.googleClientId || '',
    apiKey: settings.googleApiKey || '',
  });
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    // Load backup list if authenticated
    if (settings.isAuthenticated) {
      loadBackupList();
    }
  }, [settings.isAuthenticated]);

  const loadBackupList = async () => {
    try {
      const backups = await listGoogleDriveBackups();
      setBackupList(backups);
    } catch (error) {
      console.error('Error loading backup list:', error);
    }
  };

  const handleSetupGoogleDrive = async () => {
    if (!credentials.clientId || !credentials.apiKey) {
      setStatusMessage('❌ Please enter both Client ID and API Key');
      return;
    }

    setIsLoading(true);
    setStatusMessage('🔄 Initializing Google Drive...');

    try {
      const initialized = await initGoogleDrive(credentials.clientId, credentials.apiKey);
      
      if (initialized) {
        const signedIn = await signInToGoogleDrive();
        
        if (signedIn) {
          const newSettings = {
            ...settings,
            isAuthenticated: true,
            googleClientId: credentials.clientId,
            googleApiKey: credentials.apiKey,
          };
          setSettings(newSettings);
          saveCloudBackupSettings(newSettings);
          setStatusMessage('✅ Connected to Google Drive!');
          setShowSetup(false);
        } else {
          setStatusMessage('❌ Sign-in failed. Please try again.');
        }
      } else {
        setStatusMessage('❌ Failed to initialize. Check your credentials.');
      }
    } catch (error) {
      setStatusMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOutFromGoogleDrive();
      const newSettings = {
        ...settings,
        isAuthenticated: false,
      };
      setSettings(newSettings);
      saveCloudBackupSettings(newSettings);
      setStatusMessage('✅ Signed out from Google Drive');
    } catch (error) {
      setStatusMessage(`❌ Error signing out: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualBackup = async () => {
    setIsLoading(true);
    setStatusMessage('🔄 Creating backup...');

    try {
      // Gather all data
      const donors = JSON.parse(localStorage.getItem('animal_donors') || '[]');
      const inventory = JSON.parse(localStorage.getItem('blood_inventory') || '{}');
      const financial = JSON.parse(localStorage.getItem('financial_data') || '{}');

      const backupData = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        data: { donors, inventory, financial },
      };

      const fileName = `dono-manual-backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
      const result = await uploadToGoogleDrive(fileName, backupData);

      if (result.success) {
        setStatusMessage(`✅ Backup created: ${result.fileName}`);
        await loadBackupList();
      } else {
        setStatusMessage(`❌ Backup failed: ${result.error}`);
      }
    } catch (error) {
      setStatusMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (fileId, fileName) => {
    if (!window.confirm(`Restore backup from ${fileName}?\n\n⚠️ This will replace all current data!`)) {
      return;
    }

    setIsLoading(true);
    setStatusMessage('🔄 Restoring backup...');

    try {
      const data = await downloadFromGoogleDrive(fileId);
      
      if (data && data.data) {
        // Restore data
        if (data.data.donors) {
          localStorage.setItem('animal_donors', JSON.stringify(data.data.donors));
        }
        if (data.data.inventory) {
          localStorage.setItem('blood_inventory', JSON.stringify(data.data.inventory));
        }
        if (data.data.financial) {
          localStorage.setItem('financial_data', JSON.stringify(data.data.financial));
        }

        setStatusMessage('✅ Backup restored successfully! Please refresh the page.');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setStatusMessage('❌ Invalid backup file');
      }
    } catch (error) {
      setStatusMessage(`❌ Restore failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutoBackup = () => {
    const newSettings = {
      ...settings,
      enabled: !settings.enabled,
    };
    setSettings(newSettings);
    saveCloudBackupSettings(newSettings);
    setStatusMessage(newSettings.enabled ? '✅ Auto-backup enabled' : '⏸️ Auto-backup disabled');
  };

  const updateFrequency = (frequency) => {
    const newSettings = { ...settings, frequency };
    setSettings(newSettings);
    saveCloudBackupSettings(newSettings);
    setStatusMessage(`✅ Backup frequency set to ${frequency}`);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`min-h-screen ${colors.bg.primary} p-4`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            ☁️ Cloud Backup Manager
          </h1>
          <p className={`${colors.text.secondary} text-sm`}>
            Automatic backups to Google Drive
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`${colors.bg.card} rounded-xl p-4 mb-6 border ${colors.border.primary}`}>
            <p className={`${colors.text.primary} text-center font-medium`}>{statusMessage}</p>
          </div>
        )}

        {/* Connection Status */}
        <div className={`${colors.bg.card} rounded-xl shadow-lg p-6 mb-6 border ${colors.border.primary}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-bold ${colors.text.primary}`}>Connection Status</h2>
            {settings.isAuthenticated ? (
              <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Connected
              </span>
            ) : (
              <span className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold">
                Not Connected
              </span>
            )}
          </div>

          {!settings.isAuthenticated ? (
            <div>
              <p className={`${colors.text.secondary} mb-4`}>
                Connect your Google Drive account to enable automatic backups.
              </p>
              
              {!showSetup ? (
                <button
                  onClick={() => setShowSetup(true)}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  🔗 Connect Google Drive
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                      Google Client ID
                    </label>
                    <input
                      type="text"
                      value={credentials.clientId}
                      onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                      placeholder="Your Google OAuth Client ID"
                      className={`w-full p-3 border-2 ${colors.border.input} rounded-lg ${colors.bg.input} ${colors.text.primary}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                      Google API Key
                    </label>
                    <input
                      type="text"
                      value={credentials.apiKey}
                      onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                      placeholder="Your Google API Key"
                      className={`w-full p-3 border-2 ${colors.border.input} rounded-lg ${colors.bg.input} ${colors.text.primary}`}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSetupGoogleDrive}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    >
                      {isLoading ? '⏳ Connecting...' : '✅ Connect'}
                    </button>
                    <button
                      onClick={() => setShowSetup(false)}
                      className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className={`${colors.bg.tertiary} p-4 rounded-lg border ${colors.border.secondary}`}>
                    <p className={`text-xs ${colors.text.secondary}`}>
                      <strong>How to get credentials:</strong><br />
                      1. Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Google Cloud Console</a><br />
                      2. Create a new project or select existing<br />
                      3. Enable Google Drive API<br />
                      4. Create OAuth 2.0 Client ID credentials<br />
                      5. Create API Key<br />
                      6. Copy and paste here
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className={`${colors.text.primary} font-medium`}>
                    Last Backup: {settings.lastCloudBackup ? formatDate(settings.lastCloudBackup) : 'Never'}
                  </p>
                  <p className={`${colors.text.secondary} text-sm`}>
                    Total Backups: {settings.autoBackupCount}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
                >
                  🔌 Disconnect
                </button>
              </div>

              {/* Auto-backup Toggle */}
              <div className={`${colors.bg.tertiary} p-4 rounded-lg border ${colors.border.secondary} mb-4`}>
                <div className="flex items-center justify-between mb-3">
                  <label className={`text-sm font-medium ${colors.text.primary}`}>
                    Automatic Backups
                  </label>
                  <button
                    onClick={toggleAutoBackup}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      settings.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        settings.enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {settings.enabled && (
                  <div>
                    <label className={`block text-xs font-medium ${colors.text.secondary} mb-2`}>
                      Backup Frequency
                    </label>
                    <div className="flex gap-2">
                      {['daily', 'weekly', 'manual'].map((freq) => (
                        <button
                          key={freq}
                          onClick={() => updateFrequency(freq)}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                            settings.frequency === freq
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Backup Button */}
              <button
                onClick={handleManualBackup}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {isLoading ? '⏳ Creating Backup...' : '💾 Create Manual Backup Now'}
              </button>
            </div>
          )}
        </div>

        {/* Backup List */}
        {settings.isAuthenticated && (
          <div className={`${colors.bg.card} rounded-xl shadow-lg p-6 border ${colors.border.primary}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${colors.text.primary}`}>Available Backups</h2>
              <button
                onClick={loadBackupList}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
              >
                🔄 Refresh
              </button>
            </div>

            {backupList.length === 0 ? (
              <p className={`${colors.text.secondary} text-center py-8`}>
                No backups found. Create your first backup above!
              </p>
            ) : (
              <div className="space-y-3">
                {backupList.map((backup) => (
                  <div
                    key={backup.id}
                    className={`${colors.bg.tertiary} p-4 rounded-lg border ${colors.border.secondary} hover:border-blue-400 transition-all`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className={`font-semibold ${colors.text.primary} text-sm`}>
                          {backup.name}
                        </p>
                        <div className="flex gap-4 mt-1">
                          <span className={`text-xs ${colors.text.secondary}`}>
                            📅 {formatDate(backup.createdTime)}
                          </span>
                          <span className={`text-xs ${colors.text.secondary}`}>
                            💾 {formatFileSize(backup.size)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestore(backup.id, backup.name)}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                      >
                        ⬇️ Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudBackupManager;
