# Dono App Vol2

A comprehensive donor management application with advanced file upload and product comparison capabilities.

## Features

### Donor Management
- Add and edit donor information
- Track animal details (dogs, cats)
- Blood donation tracking
- Location-based organization
- Dashboard analytics

### Product Comparison (New!)
- **File Upload & Validation**: Support for `.csv`, `.xlsx`, `.xls`, `.json` files
- **Schema Validation**: Automatic detection and validation of required fields
- **UTF-8 & Hebrew Support**: Full support for Hebrew characters and RTL layout
- **Data Normalization**: Automatic cleaning and standardization of product data
- **Deduplication**: Intelligent removal of duplicate records
- **Monthly Comparisons**: Analyze trends and totals by month
- **Product Comparisons**: Compare performance across different products
- **Interactive Charts**: Visual representation using recharts library

## Supported File Formats

The application accepts files with the following formats:

### Required Fields
- `date` - Date of transaction (YYYY-MM-DD format)
- `productName` - Name of the product
- `quantity` - Number of items
- `price` - Unit price

### Optional Fields
- `month` - Will be auto-generated from date if not provided
- `total` - Will be calculated from quantity × price if not provided

### Field Name Variations
The parser supports various field name variations:
- **Date**: `date`, `תאריך`, `datum`, `fecha`, `data`
- **Product**: `productName`, `product`, `מוצר`, `שם מוצר`, `item`, `name`
- **Quantity**: `quantity`, `כמות`, `qty`, `amount`, `count`
- **Price**: `price`, `מחיר`, `cost`, `unitPrice`, `pricePerUnit`
- **Total**: `total`, `סה״כ`, `totalPrice`, `totalCost`, `sum`

### Sample Files

#### CSV Format (sample-products.csv)
```csv
date,productName,quantity,price,total
2025-01-15,Apple Juice,10,5.50,55.00
2025-01-15,Orange Soda,15,3.25,48.75
2025-01-16,Apple Juice,8,5.50,44.00
```

#### JSON Format (sample-electronics.json)
```json
[
  {"date": "2025-01-15", "productName": "Laptop", "quantity": 2, "price": 1200.00, "total": 2400.00},
  {"date": "2025-01-15", "productName": "Mouse", "quantity": 10, "price": 25.00, "total": 250.00}
]
```

## Hebrew Support

The application provides full Hebrew language support with:
- RTL (Right-to-Left) layout
- Hebrew field labels and UI text
- Proper Hebrew character encoding (UTF-8)
- English fallback for all text

### Hebrew Labels
- תאריך (Date)
- חודש (Month)
- מוצר (Product)
- כמות (Quantity)
- מחיר (Price)
- סה״כ (Total)

## Usage

1. **Upload Files**: Go to the Products tab and upload your data files
2. **View Data**: Browse uploaded data with sorting and filtering options
3. **Compare by Month**: Analyze monthly trends and totals
4. **Compare by Product**: Compare product performance across time periods
5. **Export Results**: View comprehensive summaries and charts

## Known Limitations

- Maximum display limit of 100 records in data table for performance
- File size limit depends on browser memory
- Excel files are converted to JSON format internally
- Time zones are not explicitly handled (dates are processed as-is)
- Duplicate detection is based on exact matching of date, product, quantity, and price

## Technical Details

- Built with React and Vite
- Uses recharts for data visualization
- Supports real-time file parsing with Papa Parse (CSV) and SheetJS (Excel)
- Implements comprehensive data validation and normalization
- Responsive design with Tailwind CSS

## Development

```bash
npm install
npm run dev    # Start development server
npm run build  # Build for production
```

## File Structure

- `src/components/ProductComparison.jsx` - Main product comparison component
- `src/utils/fileParser.js` - File parsing and data processing utilities
- `src/utils/parserTests.js` - Unit tests for parser functions
- Sample files: `sample-products.csv`, `sample-electronics.json`