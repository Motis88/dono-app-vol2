# Google Form Setup for Donor Collection
## Step-by-step guide to create and automate the donor form

---

## 📝 Part 1: Create Google Form

### 1. Go to Google Forms
Visit: https://forms.google.com and click **+ Blank**

### 2. Form Settings
- **Title:** Blood Donor Collection Form
- **Description:** Fill this form for each animal checked for blood donation

**IMPORTANT - Configure Form Reset:**
1. Click **Settings** ⚙️ (top right)
2. Go to **Presentation** tab
3. ✅ Check: **"Show link to submit another response"**
4. ✅ Uncheck: **"Edit after submit"** (prevents data persistence)
5. Set confirmation message: **"✅ Data saved! You can close this tab now."**

### 3. Add These Questions (in order):

#### **Section 1: Required Fields**

**Question 1: Date**
- Type: `Date`
- Required: ✅ Yes
- Default: Today's date

**Question 2: Location**
- Type: `Dropdown`
- Required: ✅ Yes
- Options:
  - Rehovot
  - Beit Oved
  - Igud Arim Dan
  - Petachya
  - Holon
  - External

**Question 3: Animal Name**
- Type: `Short answer`
- Required: ✅ Yes
- Placeholder: Enter animal name

**Question 4: Animal Type**
- Type: `Multiple choice`
- Required: ✅ Yes
- Options:
  - Dog
  - Cat

---

#### **Section 2: Optional Basic Info**

**Question 5: Age**
- Type: `Short answer`
- Required: ❌ No
- Validation: Number

**Question 6: Weight (kg)**
- Type: `Short answer`
- Required: ❌ No
- Validation: Number

**Question 7: Gender**
- Type: `Multiple choice`
- Required: ❌ No
- Options:
  - Male
  - Female

---

#### **Section 3: Blood Work**

**Question 8: Blood Type**
- Type: `Dropdown`
- Required: ❌ No
- Options:
  - DEA 1.1 Positive
  - DEA 1.1 Negative
  - A
  - AB
  - B

**Question 9: FIV (Cats only)**
- Type: `Multiple choice`
- Required: ❌ No
- Options:
  - Positive
  - Negative
  - Unknown

**Question 10: FeLV (Cats only)**
- Type: `Multiple choice`
- Required: ❌ No
- Options:
  - Positive
  - Negative
  - Unknown

**Question 11: PCV**
- Type: `Short answer`
- Required: ❌ No
- Validation: Number

**Question 12: HCT**
- Type: `Short answer`
- Required: ❌ No
- Validation: Number

**Question 13: WBC**
- Type: `Short answer`
- Required: ❌ No
- Validation: Number

**Question 14: PLT**
- Type: `Short answer`
- Required: ❌ No
- Validation: Number

**Question 15: Packed Cell**
- Type: `Short answer`
- Required: ❌ No
- Validation: Number

**Question 16: Slide Findings**
- Type: `Paragraph`
- Required: ❌ No

---

#### **Section 4: Donation Status**

**Question 17: Donated?**
- Type: `Multiple choice`
- Required: ❌ No
- Options:
  - Yes
  - No

**Question 18: Volume (ml)**
- Type: `Short answer`
- Required: ❌ No
- Validation: Number

**Question 19: Notes**
- Type: `Paragraph`
- Required: ❌ No

---

#### **Section 5: Owner Information (Optional)**

**Question 20: Private Owner?**
- Type: `Multiple choice`
- Required: ❌ No
- Options:
  - Yes
  - No

**Question 21: Owner Name**
- Type: `Short answer`
- Required: ❌ No

**Question 22: File Number**
- Type: `Short answer`
- Required: ❌ No

**Question 23: Owner Phone**
- Type: `Short answer`
- Required: ❌ No
- Validation: Phone number

---

## 🤖 Part 2: Setup Auto-Export to JSON

### 1. Link Form to Google Sheets
- In your Form, click **Responses** tab
- Click **Link to Sheets** (green icon)
- Create a new spreadsheet: "Donor Responses"

### 2. Add Google Apps Script
- Open the linked spreadsheet
- Go to **Extensions** → **Apps Script**
- Delete any existing code
- Paste the script below:

```javascript
function onFormSubmit(e) {
  try {
    // Get response from event object (more reliable than reading sheet)
    const formResponse = e.response;
    const itemResponses = formResponse.getItemResponses();
    
    // Extract responses by question title
    const responses = {};
    itemResponses.forEach(function(itemResponse) {
      const question = itemResponse.getItem().getTitle();
      const answer = itemResponse.getResponse();
      responses[question] = answer;
    });
    
    // Map form responses to JSON structure with normalized location
    const location = responses['Location'] || '';
    const normalizedLocation = normalizeLocation(location);
    
    const donor = {
      date: formatDate(formResponse.getTimestamp()),
      location: normalizedLocation,  // Fixed: now correctly gets location
      animalName: responses['Animal Name'] || "",
      animalType: responses['Animal Type'] || "",
      age: responses['Age'] || "",
      weight: responses['Weight (kg)'] || "",
      gender: responses['Gender'] || "",
      bloodType: responses['Blood Type'] || "",
      fiv: responses['FIV (Cats only)'] || "",
      felv: responses['FeLV (Cats only)'] || "",
      pcv: responses['PCV'] || "",
      hct: responses['HCT'] || "",
      wbc: responses['WBC'] || "",
      plt: responses['PLT'] || "",
      packedCell: responses['Packed Cell'] || "",
      slideFindings: responses['Slide Findings'] || "",
      donated: responses['Donated?'] || "",
      volume: responses['Volume (ml)'] || "",
      notes: responses['Notes'] || "",
      isPrivateOwner: responses['Private Owner?'] === "Yes",
      ownerName: responses['Owner Name'] || "",
      fileNumber: responses['File Number'] || "",
      ownerPhone: responses['Owner Phone'] || ""
    };
    
    // Validate required fields
    if (!donor.date || !donor.location || !donor.animalName || !donor.animalType) {
      Logger.log("ERROR: Missing required fields!");
      Logger.log("Date: " + donor.date);
      Logger.log("Location: " + donor.location);
      Logger.log("Animal Name: " + donor.animalName);
      Logger.log("Animal Type: " + donor.animalType);
      return;
    }
    
    // Add to "JSON Export" sheet
    const jsonSheet = getOrCreateJsonSheet();
    const jsonString = JSON.stringify(donor, null, 2);
    jsonSheet.appendRow([new Date(), jsonString]);
    
    Logger.log("✅ Donor added successfully: " + donor.animalName + " at " + donor.location);
    
  } catch (error) {
    Logger.log("❌ Error: " + error.toString());
  }
}

// Normalize location to Hebrew format (matching app storage)
function normalizeLocation(location) {
  const locationMap = {
    'Rehovot': 'רחובות',
    'Beit Oved': 'בית עובד',
    'Igud Arim Dan': 'איגוד ערים דן',
    'Petachya': 'פתחיה',
    'Holon': 'חולון',
    'External': 'חיצוני'
  };
  return locationMap[location] || location;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getOrCreateJsonSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let jsonSheet = spreadsheet.getSheetByName("JSON Export");
  
  if (!jsonSheet) {
    jsonSheet = spreadsheet.insertSheet("JSON Export");
    jsonSheet.appendRow(["Timestamp", "JSON Data"]);
    jsonSheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  }
  
  return jsonSheet;
}

function exportAllToJson() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form Responses 1");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const donors = [];
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const location = normalizeLocation(row[headers.indexOf('Location')] || '');
    
    const donor = {
      date: formatDate(row[0]), // Timestamp is always first column
      location: location,
      animalName: row[headers.indexOf('Animal Name')] || "",
      animalType: row[headers.indexOf('Animal Type')] || "",
      age: row[headers.indexOf('Age')] || "",
      weight: row[headers.indexOf('Weight (kg)')] || "",
      gender: row[headers.indexOf('Gender')] || "",
      bloodType: row[headers.indexOf('Blood Type')] || "",
      fiv: row[headers.indexOf('FIV (Cats only)')] || "",
      felv: row[headers.indexOf('FeLV (Cats only)')] || "",
      pcv: row[headers.indexOf('PCV')] || "",
      hct: row[headers.indexOf('HCT')] || "",
      wbc: row[headers.indexOf('WBC')] || "",
      plt: row[headers.indexOf('PLT')] || "",
      packedCell: row[headers.indexOf('Packed Cell')] || "",
      slideFindings: row[headers.indexOf('Slide Findings')] || "",
      donated: row[headers.indexOf('Donated?')] || "",
      volume: row[headers.indexOf('Volume (ml)')] || "",
      notes: row[headers.indexOf('Notes')] || "",
      isPrivateOwner: row[headers.indexOf('Private Owner?')] === "Yes",
      ownerName: row[headers.indexOf('Owner Name')] || "",
      fileNumber: row[headers.indexOf('File Number')] || "",
      ownerPhone: row[headers.indexOf('Owner Phone')] || ""
    };
    
    // Only add if has required fields
    if (donor.date && donor.location && donor.animalName && donor.animalType) {
      donors.push(donor);
    }
  }
  
  const jsonSheet = getOrCreateJsonSheet();
  const jsonString = JSON.stringify(donors, null, 2);
  jsonSheet.appendRow([new Date(), jsonString]);
  
  SpreadsheetApp.getUi().alert(`✅ Exported ${donors.length} donors to JSON!`);
}
```

### 3. Setup Trigger
- In Apps Script, click **⏰ Triggers** (left sidebar clock icon)
- Click **+ Add Trigger**
- Settings:
  - Function: `onFormSubmit`
  - Event source: `From spreadsheet`
  - Event type: `On form submit`
- Click **Save**

### 4. Authorize the Script
- You'll be asked to authorize
- Click **Review Permissions** → Choose your Google account
- Click **Advanced** → **Go to Donor Responses (unsafe)**
- Click **Allow**

---

## 📤 Part 3: How to Export Donors

### Option A: Auto Export (After Each Submission)
- Every time someone submits the form
- JSON is automatically added to "JSON Export" sheet
- You can copy-paste from there

### Option B: Manual Batch Export
- Open the spreadsheet
- Go to **Extensions** → **Apps Script**
- Run function: `exportAllToJson`
- All donors will be exported as one JSON array

### Option C: Download JSON File
Add this function to Apps Script:

```javascript
function downloadJson() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form Responses 1");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const donors = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const location = normalizeLocation(row[headers.indexOf('Location')] || '');
    
    const donor = {
      date: formatDate(row[0]),
      location: location,
      animalName: row[headers.indexOf('Animal Name')] || "",
      animalType: row[headers.indexOf('Animal Type')] || "",
      age: row[headers.indexOf('Age')] || "",
      weight: row[headers.indexOf('Weight (kg)')] || "",
      gender: row[headers.indexOf('Gender')] || "",
      bloodType: row[headers.indexOf('Blood Type')] || "",
      fiv: row[headers.indexOf('FIV (Cats only)')] || "",
      felv: row[headers.indexOf('FeLV (Cats only)')] || "",
      pcv: row[headers.indexOf('PCV')] || "",
      hct: row[headers.indexOf('HCT')] || "",
      wbc: row[headers.indexOf('WBC')] || "",
      plt: row[headers.indexOf('PLT')] || "",
      packedCell: row[headers.indexOf('Packed Cell')] || "",
      slideFindings: row[headers.indexOf('Slide Findings')] || "",
      donated: row[headers.indexOf('Donated?')] || "",
      volume: row[headers.indexOf('Volume (ml)')] || "",
      notes: row[headers.indexOf('Notes')] || "",
      isPrivateOwner: row[headers.indexOf('Private Owner?')] === "Yes",
      ownerName: row[headers.indexOf('Owner Name')] || "",
      fileNumber: row[headers.indexOf('File Number')] || "",
      ownerPhone: row[headers.indexOf('Owner Phone')] || ""
    };
    
    if (donor.date && donor.location && donor.animalName && donor.animalType) {
      donors.push(donor);
    }
  }
  
  const blob = Utilities.newBlob(JSON.stringify(donors, null, 2), 'application/json', 'donors.json');
  DriveApp.createFile(blob);
  
  SpreadsheetApp.getUi().alert('✅ JSON file created in your Google Drive with ' + donors.length + ' donors!');
}
```

---

## 🔗 Part 4: Share Form with Team

1. Click **Send** button (top right)
2. Copy the form link
3. Share with your team via WhatsApp/Email
4. They can save it to their phone home screen for quick access

**Pro Tip:** Shorten the URL with bit.ly for easier sharing!

---

## 📱 Part 5: Import to Your App

### Method 1: Copy-Paste from "JSON Export" Sheet
1. Open spreadsheet → "JSON Export" tab
2. Copy the latest JSON
3. In your app: Import → Paste JSON

### Method 2: Download JSON file
1. Run `downloadJson` function in Apps Script
2. Download file from Google Drive
3. Import to app

---

## ✅ Testing Checklist

- [ ] Form opens on mobile
- [ ] All required fields work
- [ ] Optional fields can be skipped
- [ ] Submission success message appears
- [ ] Data appears in spreadsheet
- [ ] JSON appears in "JSON Export" sheet
- [ ] Test import in your app

---

## 🆘 Troubleshooting

**Problem:** Script doesn't run on form submit
- **Solution:** Check trigger is enabled in Apps Script

**Problem:** Location field is empty in JSON
- **Solution:** Make sure you're using the UPDATED script above (uses `e.response` instead of sheet columns)

**Problem:** Form shows old data after submit
- **Solution:** In Form Settings → Presentation → Uncheck "Edit after submit"

**Problem:** Missing required fields (date/location/name/type)
- **Solution:** The script now validates and skips incomplete submissions - check Apps Script logs

**Problem:** Hebrew locations not showing correctly
- **Solution:** Script now auto-converts English → Hebrew using `normalizeLocation()`

---

## 📋 What's New in This Version?

✅ **Fixed location mapping** - Now correctly extracts location from form responses  
✅ **Hebrew location conversion** - Auto-converts "Rehovot" → "רחובות" etc.  
✅ **Required fields validation** - Won't create JSON if missing date/location/name/type  
✅ **Better error logging** - Shows exactly which fields are missing  
✅ **Form auto-reset** - Clear instructions to prevent data persistence  

---

## 📞 Need Help?
If anything doesn't work, send me the error message and I'll help fix it!
