# Cloud Backup Setup Guide

## Google Drive Integration

### Prerequisites
1. Google Account
2. Google Cloud Console access

### Step-by-Step Setup

#### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "New Project" or select existing project
3. Name your project (e.g., "Dono App Backup")
4. Click "Create"

#### 2. Enable Google Drive API
1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

#### 3. Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - User Type: External (for personal use)
   - App name: "Dono App"
   - User support email: Your email
   - Developer contact: Your email
   - Save and Continue through remaining steps
4. Back to "Create OAuth client ID":
   - Application type: Web application
   - Name: "Dono App Web Client"
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for development)
     - `https://yourdomain.com` (for production)
     - `capacitor://localhost` (for mobile app)
   - Authorized redirect URIs:
     - `http://localhost:5173` (for development)
     - Add your production domain if applicable
5. Click "Create"
6. **Copy the Client ID** - you'll need this!

#### 4. Create API Key
1. Still in "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "API key"
3. **Copy the API Key** - you'll need this!
4. (Recommended) Click "Restrict Key":
   - Application restrictions: Select appropriate option
   - API restrictions: Restrict to "Google Drive API"
   - Save

#### 5. Configure in Dono App
1. Open Dono App
2. Navigate to Cloud Backup (☁️ icon)
3. Click "Connect Google Drive"
4. Enter your **Client ID** and **API Key**
5. Click "Connect"
6. Sign in with your Google Account
7. Grant permissions to the app

### Features

#### Automatic Backups
- **Daily**: Backs up every 24 hours
- **Weekly**: Backs up every 7 days
- **Manual**: Only when you click "Create Backup"

#### What Gets Backed Up
- All donor records
- Inventory data
- Financial data
- Settings and preferences

#### Backup Management
- Automatically keeps last 10 backups
- Older backups are deleted automatically
- You can manually restore any backup

### Troubleshooting

#### "Failed to initialize" Error
- Verify Client ID and API Key are correct
- Check that Google Drive API is enabled
- Ensure authorized origins include your domain

#### "Sign-in failed" Error
- Clear browser cache and cookies
- Try again in incognito/private mode
- Verify OAuth consent screen is configured

#### "Upload failed" Error
- Check internet connection
- Verify you have Google Drive storage space
- Try signing out and back in

### Security Notes
- Your credentials are stored locally only
- Backups are stored in your personal Google Drive
- Only you have access to your backup files
- The app cannot access other files in your Drive

### Manual Backup (Alternative)
If cloud backup doesn't work, you can always:
1. Use the "Backup" button in the menu
2. Save the JSON file manually
3. Store it in your preferred location

---

## Support
For issues or questions, please contact support or check the app documentation.
