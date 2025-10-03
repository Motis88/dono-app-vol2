# Changelog

All notable changes to Dono App Vol2 will be documented in this file.

## [2.0.2] - 2025-10-03

### Added
- **CSV Export**: Export donor data to CSV format with UTF-8 BOM encoding (Excel-compatible)
  - Includes all 24 donor fields
  - Proper escaping for commas, quotes, and newlines
  - File naming with timestamp
- **Icon-based navigation**: Navigation buttons now use clear emoji icons:
  - 📝 Form (Add Donor)
  - 📋 Table (Donors List)
  - 📊 Dashboard (Statistics)
  - 👥 Owners (Private Owners)
  - Tooltips on hover for desktop

### Changed
- **Full English UI**: All user-facing text converted to English
  - Alerts and confirmations
  - Buttons and labels
  - Empty states and error messages
  - Search and filter placeholders
  - Only location names remain in Hebrew (required)
- **Navigation improvements**: Larger, more prominent icon buttons with better touch targets
- **Export buttons**: Shortened labels ("JSON" and "CSV" instead of "Export JSON/CSV")

### Fixed
- Duplicate catch block in backup error handling
- Consistent English messaging across all components

## [2.0.1] - 2025-10-03

### Added
- **Auto-mark private owners**: Donors with owner information (name/phone/file number) are now automatically marked as private owners, ensuring they appear in the Owners tab
- **Enhanced search functionality**: Free-text search now works across ALL donor fields, not just animal names
- **Phone number validation**: Automatic sanitization of phone input (allows only digits, spaces, hyphens, and plus signs)
- **Hebrew translations**: All user-facing messages, alerts, and confirmations now in Hebrew
- **Improved delete confirmations**: Shows donor details (name, type, date, owner) before deletion
- **Better import/export feedback**: 
  - Import shows count of total donors and private owners imported
  - Export includes private owner count and file details
- **Enhanced empty states**: Context-aware messages when no data or filtered results are shown
- **Filter result counter**: Hebrew display of active filters and result count

### Changed
- **Search placeholder**: Updated to "🔍 חיפוש חופשי (כל שדה)..." for accuracy
- **Clear All button**: More prominent styling with gradient, Hebrew text, and icon
- **Eligible donor highlighting**: Changed from yellow background to green glowing border for better dark mode compatibility
- **Error messages**: More descriptive Hebrew messages with context
- **Dark mode improvements**: Enhanced contrast and readability across all cards and tables

### Fixed
- **Dark mode card backgrounds**: All TABLE view cards now properly display in dark mode
- **Private owner persistence**: isPrivateOwner flag now correctly saved during form submission and import
- **Blood type normalization**: Automatic correction of imported blood type values
- **Search diacritics**: Search now ignores Hebrew diacritics (nikud) for better matching

## [2.0.0] - 2025-10-02

### Added
- Blood type normalization system for imported data
- One-time "Fix Blood Types" button for existing data
- Dashboard statistics with pie charts
- Dark mode support with theme persistence
- Green border highlighting for eligible donors (90+ days)

### Changed
- Removed old dashboard chart
- Redesigned statistics layout with pie charts
- Improved pie chart labels (show percentages inside slices)

### Fixed
- Blood type recognition for imported donors
- Dark mode compatibility in DonorForm (FIV/FeLV status)
- Dark mode compatibility in ManualDonorList (OWNERS tab)
- Dashboard visual consistency

## [1.0.0] - Initial Release

### Added
- Multi-location donor management
- Blood work tracking (PCV, HCT, WBC, PLT)
- Private owner management
- Import/Export JSON functionality
- Location-based filtering
- Animal type and date filtering
- Donor eligibility tracking (90-day intervals)
- Swipe navigation between views
- Mobile-first responsive design

---

## Legend
- **Added**: New features
- **Changed**: Changes in existing functionality
- **Fixed**: Bug fixes
- **Removed**: Removed features
- **Security**: Security improvements
