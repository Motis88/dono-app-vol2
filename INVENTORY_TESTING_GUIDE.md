# Inventory Manager Testing Guide

## Quick Start Test

### Prerequisites
1. Build completed successfully ✓
2. Medicine Usage CSV from your clinic system
3. Browser with dev tools ready

### Test Sequence

#### Test 1: Initial Upload (Medicine Usage CSV)
1. Open app → Navigate to Inventory tab
2. Click "Upload Usage CSV"
3. Select your Medicine Usage export (e.g., `Medicine_usage_01-01-2026_-_31-01-2026.csv`)
4. **Expected Results**:
   - Alert shows: New units, duplicates, skipped rows
   - Overview displays statistics
   - File appears in "Uploaded Files" list
   - Month-to-Date section shows current month totals

#### Test 2: Deduplication (Idempotency)
1. Click "Upload Usage CSV" again
2. Select same `sample_usage_data.csv`
3. **Expected Results**:
   - Alert: "✅ Import complete! New units: 0, Duplicates skipped: 11"
   - Totals unchanged (still 9 regular, 2 external)
   - File list now shows 2 files (both references kept, data not duplicated)

#### Test 3: Month Boundaries
1. Click "Monthly Summary" button
2. **Expected Results**:
   - January 2026: 9 units (7 regular + 2 external)
   - February 2026: 2 units (1 regular + 1 external)
   - No mixing between months

#### Test 4: Month-to-Date (In Overview)
1. Scroll down in Overview
2. Find "Month-to-Date (Current Month)" section
3. **Expected Results**:
   - Shows current month name
   - Two cards: Regular units + External units
   - Product breakdown table below
   - Only current month data shown

#### Test 6: External Classification
1. Check any view's product breakdown
2. **Expected Results**:
   - Purple column for "External"
   - Units containing "חיצוני" classified correctly:
     - UNIT003 (Whole Blood Dog - external)
     - UNIT007 (Whole Blood Cat - external)
     - UNI5: External Classification
1. Check product breakdown tables
2. Look fo6 products with "- 'חיצוני'" in CSV
3. **Expected Results**:
   - Purple column for "External"
   - Units with "חיצוני" in Medicine name classified as external
   - Example: "מנת דם מלא- חתול mdm cat - 'חיצוני'" → External column
   - File reference removed from list
   - **All summaries unchanged** (data persists!)
   - No errors in console

#### Test 7: Inventory Snapshot
1. Click "Upload Inventory Snapshot"
2. Select `sample_inventory_snapshot.csv`
3. **Expected Results**:
   - Alert: "✅ Inventory snapshot updated! Date: 2026-02-01, Products: 7"
   - Overview shows new "Current Inventory" section
   - Inventory shows snapshot - usage after snapshot date

#### Test 8: Dark Mode
1. Toggle dark mode (if theme switcher available)
2. Check all views
3. **Expected Results**:
   - All text readable (no gray-on-gray)
   - High contrast maintained:
     - Headers: white/black text
     - Subtext: visible gray
     - Tables: clear borders
     - Color-coded stats: blue/purple variants visible

#### Test 9: Data Persistence
1. Refresh browser (F5)
2. Check all views
3. **Expected Results**:
   - All data still present
   - File list maintained
   - Inventory snapshot preserved
   - Summaries identical to before refresh

## Detailed Verification

### Month Boundary Test (Critical)

Using sample data:
- Jan 31, 2026 @ 11:59 PM → January
- Feb 1, 2026 @ 12:00 AM → February

**Verify**:
```
Monthly Summary:
├─ January 2026: 9 units
│  ├─ Regular: 7 units
│  └─ External: 2 units
└─ February 2026: 2 units
   ├─ Regular: 1 unit
   └─ External: 1 unit

Month-to-Date (February 2026):
├─ Regular: 1 unit
└─ External: 1 unit
```

### Product Normalization Test

Hebrew → English mapping:

| CSV Product Name | Expected Key | Expected Display |
|------------------|--------------|------------------|
| מנת דם מלא- כלב | whole_blood_dog | Whole Blood Dog |
| מנת דם טרי כלב | fresh_blood_dog | Fresh Whole Blood Dog |
| מנת דם פלסמה חתול | plasma_cat | Plasma Cat |
| מנת דם תרכיז תאים כלב | prbc_dog | pRBC Dog |

Check Product Breakdown Table → all products display English names.

### External Units Test

Units with "חיצוני" in name:
- UNIT003: Whole Blood Dog חיצוני → External
- UNIT007: Whole Blood Cat חיצוני → External  
- UNIT011: Fresh Blood Dog חיצוני → External

**Verify in tables**:
- "External" column shows these units
- "Regular" column excludes them
- "Total" column = Regular + External

### Deduplication Test

**Unit ID generation** uses:
1. Date
2. Unit ID from CSV
3. Product name
4. Location
5. Row index

Re-uploading identical file:
- Same composite key → Same hash → Same unit ID
- Duplicate detection works
- No counter increment

**Try**: Upload file twice, check console for debug logs.

### Inventory Calculation Test

Given:
- Snapshot date: Feb 1, 2026
- Snapshot counts: Various products
- Usage after Feb 1: 2 units

**Expected**:
```
Current Inventory = Snapshot - Usage After Snapshot
Fresh Blood Dog = 25 - 1 (UNIT011 on Feb 1) = 24
Plasma Cat = 8 - 1 (UNIT010 on Feb 1) = 7
[Other products unchanged]
```

## Edge Cases

### Empty State
1. Clear localStorage: `localStorage.removeItem('blood_inventory_v2')`
2. Refresh page
3. **Expected**: Clean UI, no crashes, "No data available" messages

### Invalid CSV
1. Create CSV with missing date column
2. Upload
3. **Expected**: Rows without dates skipped, no crash, alert shows count

### Unknown Product
1. Create CSV with product name "Unknown Product XYZ"
2. Upload
3. **Expected**: Unknown products skipped, alert shows count

### Large Dataset
1. Generate CSV with 1000+ rows
2. Upload
3. **Expected**: 
   - No freeze/crash
   - Fast aggregation (<1 second)
   - Smooth scrolling in summaries

## Browser Console Checks

Expected logs:
```
✓ No errors
✓ No warnings (except browserslist update notice)
✓ localStorage size reasonable (<1MB for sample data)
```

Check localStorage:
```javascript
JSON.parse(localStorage.getItem('blood_inventory_v2'))
// Should show: units, files, inventorySnapshot, version: 2
```

## Performance Benchmarks

With sample data (11 units):
- Initial load: <100ms
- CSV parse: <50ms
- Aggregation: <10ms
- View switch: <50ms

With 1000 units:
- Initial load: <500ms
- CSV parse: <200ms
- Aggregation: <50ms
- View switch: <100ms

## Accessibility Check

1. Tab navigation: Can navigate all buttons/inputs
2. Screen reader: Labels present on inputs
3. Color blind: Data not reliant only on color (text labels present)
4. Keyboard: Can upload files via keyboard

## Mobile Responsive Check

1. Resize browser to 375px width
2. Check:
   - Tables scroll horizontally ✓
   - Buttons stack vertically ✓
   - Text readable (no tiny fonts) ✓
   - Upload buttons accessible ✓

## Dark Mode Contrast Verification

Use browser dev tools → Rendering → Emulate vision deficiencies:

1. **Protanopia** (red-blind)
   - Blue/purple still distinguishable ✓
   
2. **Deuteranopia** (green-blind)
   - Text contrast sufficient ✓
   
3. **Tritanopia** (blue-blind)
   - Yellow/orange warnings visible ✓
   
4. **Achromatopsia** (no color)
   - Data still understandable via labels ✓

## Regression Tests

After any code changes, verify:
- [ ] Deduplication still works
- [ ] Month boundaries correct
- [ ] External classification accurate
- [ ] File deletion doesn't affect data
- [ ] Dark mode readable
- [ ] Build succeeds
- [ ] No console errors

## Known Issues

None currently. If you find any, document here.

---

**Testing Completed**: __________
**Tested By**: __________
**Issues Found**: __________
**Status**: [ ] PASS [ ] FAIL
