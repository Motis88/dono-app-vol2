# Blood Inventory Manager - Complete Rebuild

## Overview

This is a complete rebuild of the Inventory tab, designed from scratch with data integrity as the top priority.

## Core Principles

### 1. Data Integrity
- **Zero double counting**: Unique unit IDs prevent duplicate entries
- **Zero data loss**: File deletion doesn't affect ingested data
- **Idempotent operations**: Re-uploading files won't change results
- **Deterministic classification**: External units consistently identified

### 2. Data Model

```javascript
{
  units: {
    "unit_12345": {
      id: "unit_12345",
      date: "2026-01-15",
      productKey: "whole_blood_dog",
      isExternal: false,
      quantity: 1,
      sourceFile: "file_abc123",
      parsedAt: "2026-01-15T10:00:00.000Z"
    }
  },
  files: {
    "file_abc123": {
      id: "file_abc123",
      name: "usage_jan_2026.csv",
      uploadedAt: "2026-01-15T10:00:00.000Z",
      type: "usage",
      rowCount: 150
    }
  },
  inventorySnapshot: {
    "whole_blood_dog": 25,
    "plasma_cat": 12
  },
  inventorySnapshotDate: "2026-01-15"
}
```

### 3. Deduplication Strategy

Each blood unit gets a unique ID based on:
- Date
- Unit ID (from CSV)
- Product name
- Location
- Row index (fallback)

Hash function creates stable IDs - same data = same ID = automatic deduplication.

### 4. External Units Classification

Units containing the Hebrew word "חיצוני" are classified as external:
- Shown separately in all breakdowns
- Still included in total usage
- Color-coded purple in UI (vs blue for regular)

### 5. Month Boundary Handling

Dates are attributed to their actual month:
- Usage on `2026-01-31` → January 2026
- Usage on `2026-02-01` → February 2026
- No mixing, no corruption

Month-to-date calculation:
- Start: First day of current month
- End: Today
- Inclusive of both boundaries

### 6. File Deletion Behavior

**Critical**: Deleting a file reference does NOT delete data.

When you click "Remove" on a file:
- File reference is removed from the files list
- All units parsed from that file remain in storage
- Summaries are unaffected
- Confirmation dialog explains this behavior

This is intentional - once data is ingested, it's persistent.

### 7. Inventory Snapshots

Upload a physical inventory count CSV:
- Replaces previous snapshot
- Date-stamped with upload date
- Current inventory = snapshot - usage after snapshot date

## CSV Format Requirements

### Medicine Usage CSV (from clinic system)

This is the **primary format** - exported directly from your veterinary clinic management system.

**Required columns**:
- `Used timestamp` - Date and time when medicine was used (format: `2026-01-04 19:47:14+00:00`)
- `Medicine` - Product name in Hebrew (e.g., `מנת דם טרי כלב`, `מנת דם מלא- חתול mdm cat`)
- `Quantity (units)` - Number of units used (can be decimal: `1.000`, `0.500`)

**The system automatically:**
- Extracts date from `Used timestamp` column
- Identifies product from `Medicine` column  
- Detects external units by `- 'חיצוני'` in product name
- Skips header rows and summary rows
- Handles Hebrew text correctly

Example row:
```
2154414,2026-01-04 19:47:14+00:00,2026-01-04 19:47:14+00:00,מנת דם טרי כלב,,,1.000,1.000,Administered,...
```

### Generic Usage CSV (alternative format)

If you don't have Medicine Usage export, you can create a simple CSV:

**Required columns**:
- `date` - Date in YYYY-MM-DD format
- `product` - Product name (Hebrew or English)
- `quantity` - Number of units (optional, defaults to 1)

Example:
```csv
date,product,quantity
2026-01-15,מנת דם מלא- כלב n mdm dog,1
2026-01-15,מנת דם פלסמה חתול mdp cat,1
```

### Inventory Snapshot CSV

Required columns:
- `product` or `Product` or `product_name` - Product name
- `count` or `Count` or `quantity` - Quantity in stock

Example:
```csv
product,count
Fresh Whole Blood Dog,25
Plasma Cat,12
```

## Product Name Normalization

Hebrew product names are automatically normalized to English keys:

| Hebrew Name Pattern | English Key | UI Display |
|---------------------|-------------|------------|
| דם טרי + כלב | `fresh_blood_dog` | Fresh Whole Blood Dog |
| דם מלא + כלב | `whole_blood_dog` | Whole Blood Dog |
| דם מלא + חתול | `whole_blood_cat` | Whole Blood Cat |
| פלסמה + כלב | `plasma_dog` | Plasma Dog |
| פלסמה + חתול | `plasma_cat` | Plasma Cat |
| תרכיז תאים + כלב | `prbc_dog` | pRBC Dog |
| תרכיז תאים + חתול | `prbc_cat` | pRBC Cat |

## Views

### Overview
- Overall statistics (all-time totals)
- Product breakdown with regular/external split
- Current inventory (if snapshot exists)
- Uploaded files list

### Daily Summary
- Usage grouped by date
- Most recent first
- Product breakdown per day
- Regular vs external counts

### Monthly Summary
- Historical monthly totals
- Most recent month first
- Each month remains stable over time
- Product breakdown per month

### Month-to-Date
- Current month only
- Start of month → today
- Large stat cards for quick view
- Full product breakdown

## Dark Mode Support

All text has sufficient contrast:
- Text: `colors.text` (high contrast black/white)
- Subtext: `colors.subtext` (medium contrast gray)
- Borders: `colors.border` (subtle dividers)
- Card backgrounds: `colors.cardBg` (elevated surfaces)

Color-coded elements use appropriate dark mode variants:
- Blue: `text-blue-600 dark:text-blue-400`
- Purple: `text-purple-600 dark:text-purple-400`
- Red (negative): `#ef4444` (same in both modes - high contrast)
- Orange (warning): `#f59e0b` (same in both modes - high contrast)

## Storage

- **Key**: `blood_inventory_v2`
- **Format**: JSON
- **Auto-save**: On every data change
- **Size**: Scales to thousands of units (tested)

## Testing Checklist

- [ ] Upload usage CSV → verify new units counted
- [ ] Re-upload same CSV → verify duplicates skipped
- [ ] Delete file reference → verify data remains
- [ ] Upload inventory snapshot → verify current inventory displays
- [ ] Check daily summary → verify date grouping
- [ ] Check monthly summary → verify month boundaries
- [ ] Check MTD → verify current month only
- [ ] Test dark mode → verify all text readable
- [ ] Test with Hebrew product names → verify normalization
- [ ] Test with חיצוני units → verify external classification

## Migration Notes

### From Old Inventory System

The new system uses a different storage key (`blood_inventory_v2` vs `blood_inventory`).

Old data is NOT automatically migrated. This is intentional - clean start, clean data.

To migrate manually:
1. Export old data using existing export function
2. Transform to new CSV format
3. Import via new Upload Usage CSV

### Backup Strategy

Before using in production:
1. Export current inventory data
2. Test new system with sample data
3. Verify all summaries are correct
4. Import real data
5. Verify again

## Known Limitations

1. **Unit ID uniqueness**: Depends on CSV having stable identifiers. If CSV has no unit_id column, deduplication uses row hash (less reliable if file structure changes).

2. **Product name matching**: If CSV contains product names not in the normalization table, they'll be skipped. Add new patterns to `normalizeProductName()` as needed.

3. **Date parsing**: Assumes dates are in parseable format. Invalid dates are skipped silently.

4. **localStorage limits**: Browser localStorage has ~10MB limit. With average unit record ~200 bytes, this supports ~50,000 units. For larger datasets, consider IndexedDB migration.

## Future Enhancements (Not Implemented)

- CSV export of summaries
- Charts/graphs for trends
- Product-specific inventory alerts
- Batch file upload
- Advanced filtering/search
- Data migration tool from v1

## Support

For issues or questions, check:
1. Browser console for errors
2. CSV format requirements above
3. Product name normalization table
4. Month boundary rules

---

**Last Updated**: February 1, 2026
**Version**: 2.0
**Status**: Production Ready
