
# Dono App Vol2 - B### 📦 Inventory Management
- **Blood product stock tracking** for all product types
- **Automatic inventory updates** from monthly Medicine Usage CSV imports
- **Low stock alerts** (threshold: 10 units per product)
- **Product categorization** by species (dog/cat) and type (whole blood, plasma, pRBC)
- **Usage history** with detailed tracking
- **Manual adjustments** for received/used quantities
- Clear product codes: `FRESH BLOOD`, `WHOLE BLOOD DOG/CAT`, `PLASMA DOG/CAT`, `PC DOG/CAT`
- Smart matching for product name variations
- Modern gradient UI with animated effects

### 💰 Financial Tracker
- **Revenue tracking** from Item Sales reports
- **Total revenue** display (excl. & incl. VAT)
- **Product-level sales** analytics
- **Average price per unit** calculations
- **Sales history** with detailed import records
- Financial summary cards with key metrics
- Beautiful gradient design (emerald → green → teal)
- Export-ready financial dataation Management System

## About the Application
Dono App Vol2 is a comprehensive blood donation management system for veterinary clinics. The application tracks animal donors across multiple clinic locations with complete blood work data, donor eligibility tracking, and private owner management.

**Built with:** React + Vite + Capacitor (Hybrid Mobile App)

## Key Features

### 📋 Donor Management
- **Complete donor profiles** with blood type, medical history, and test results
- **Private owner tracking** with contact information and file numbers
- **Automatic eligibility calculation** for re-donation (90-day intervals)
- **Smart highlighting** for donors ready to donate again

### 🏥 Multi-Location Support
- Track donors across multiple clinic locations
- Location-based filtering and organization
- Hebrew location support: רחובות, בית עובד, איגוד ערים דן, פתחיה, חולון, חיצוני

### � Inventory Management (NEW!)
- **Blood product stock tracking** for all product types
- **Automatic inventory updates** from monthly sales CSV imports
- **Low stock alerts** (threshold: 10 units per product)
- **Product categorization** by species (dog/cat) and type (whole blood, plasma, pRBC)
- **Sales history** with detailed tracking
- **Manual adjustments** for received/used quantities
- Supports clinic management system codes (mdmdog001, mdpcat007, etc.)

### �🔍 Advanced Search & Filtering
- **Free-text search** across all donor fields
- Filter by animal type, blood type, date, and location
- Search supports Hebrew and English with diacritic normalization

### 📊 Analytics Dashboard
- Blood type distribution pie charts (Dogs & Cats)
- Monthly donation statistics
- Sample size tracking
- Visual breakdown of donor populations
- **Export statistics to CSV**

### 💾 Data Management
- **Import/Export** JSON files
- **CSV Export** with UTF-8 BOM for Excel compatibility
- **Automatic backup system** with weekly reminders
- **Last backup indicator** showing backup age
- Data normalization and deduplication
- Blood type auto-correction for imported data

### 🌓 Dark Mode Support
- Full dark mode theme with optimized contrast
- Automatic theme persistence
- System preference detection

## Recent Improvements (Latest Session)

### ✅ Completed Fixes
1. **Auto-mark private owners**: Donors with owner information are automatically flagged as private owners
2. **Icon-based navigation**: Clear emoji icons (📝 Form, 📋 Table, 📊 Dashboard, 👥 Owners) replace text buttons
3. **CSV export functionality**: Export donor data to CSV format compatible with Excel (UTF-8 with BOM)
4. **Full English UI**: All user-facing text now in English (except Hebrew location names which are required)
5. **Improved search placeholder**: "🔍 Search any field..." accurately describes free-text search
6. **Better delete confirmations**: Show donor details before deletion
7. **Phone number validation**: Auto-sanitize phone input (digits, spaces, hyphens only)
8. **Enhanced import messages**: Show count of private owners imported
9. **Improved export messages**: Include private owner count in export success
10. **Better empty states**: Helpful messages when no data or filtered results

### 🎨 UI/UX Enhancements
- Icon-based navigation with tooltips for better clarity
- Green glowing border for eligible donors (instead of yellow background)
- Improved dark mode compatibility for all cards and tables
- Better contrast and readability across all views
- More intuitive filter controls
- CSV export with proper UTF-8 encoding for Excel compatibility

## Goals
- **Efficient Donation Management:** Easy-to-use interface for tracking donations and donors
- **Data Reliability:** Automatic normalization and validation of blood types and donor info
- **Multi-location Workflow:** Support for veterinary clinics with multiple branches
- **Owner Privacy:** Dedicated tracking system for private donor animals

## Usage

### Adding a Donor
1. Navigate to **Form** tab
2. Fill in required fields (Date, Location, Animal Name, Type, Blood Type)
3. For private owners: Check "בעלים פרטי" and fill owner details
4. Submit to save

### Finding Donors
1. Go to **Table** tab
2. Select location from top buttons
3. Use filters: Animal Type, Date, or free-text search
4. Click on any card/row for full details

### Managing Private Owners
1. Visit **Owners** tab
2. View donors sorted by eligibility status (Ready/Soon/Not Ready)
3. Click cards for full donation history
4. Track next eligible donation dates

### Exporting Data
1. In **Table** tab, click "💾 Export JSON"
2. File saved to Documents folder with timestamp
3. Includes all donors and private owner information

## Development

### Build Commands
```bash
npm run dev          # Vite dev server
npm run build        # Production build to dist/
npm run preview      # Preview production build
npx cap run android  # Run on Android device/emulator
```

### Project Structure
```
src/
├── components/       # React components
├── utils/           # Helper functions and constants
├── contexts/        # React contexts (Theme)
└── main.jsx         # App entry point
```

## Future Improvements
- CSV/Excel export functionality
- Column sorting in table view
- Bulk delete with selection
- Advanced analytics and reporting
- Multi-language support beyond Hebrew/English
- Automated donor notifications (SMS/Email)

## Notes and Recommendations
- **Backup regularly**: Use Export JSON feature frequently
- **Data validation**: App auto-corrects blood types on import
- **Private owners**: Any donor with owner info is auto-marked as private owner
- **Dark mode**: Toggle in top-right menu (persists across sessions)
- **Search tips**: Search works on ALL fields, not just names

## Technical Details
- **State Management**: Pure React hooks (no Redux/MobX)
- **Storage**: localStorage with JSON serialization
- **Mobile**: Capacitor for native features (filesystem, sharing)
- **Styling**: Tailwind CSS with custom theming
- **Charts**: Recharts for dashboard visualizations

---

**Version:** 2.0  
**Last Updated:** October 2025  
**Maintained by:** Development Team

