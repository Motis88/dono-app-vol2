# Google Form Setup for Donor Collection
## Step-by-step guide to create and automate the donor form

---

## 📝 Part 1: Create Google Form

### 1. Go to Google Forms
Visit: https://forms.google.com and click **+ Blank**

### 2. Form Settings
- **Title:** Blood Donor Collection Form
- **Description:** Fill this form for each animal checked for blood donation

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
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Map form responses to JSON structure
    const donor = {
      date: formatDate(data[0]), // Column A: Timestamp
      location: data[1] || "",
      animalName: data[2] || "",
      animalType: data[3] || "",
      age: data[4] || "",
      weight: data[5] || "",
      gender: data[6] || "",
      bloodType: data[7] || "",
      fiv: data[8] || "",
      felv: data[9] || "",
      pcv: data[10] || "",
      hct: data[11] || "",
      wbc: data[12] || "",
      plt: data[13] || "",
      packedCell: data[14] || "",
      slideFindings: data[15] || "",
      donated: data[16] || "",
      volume: data[17] || "",
      notes: data[18] || "",
      isPrivateOwner: data[19] === "Yes",
      ownerName: data[20] || "",
      fileNumber: data[21] || "",
      ownerPhone: data[22] || ""
    };
    
    // Add to "JSON Export" sheet
    const jsonSheet = getOrCreateJsonSheet();
    const jsonString = JSON.stringify(donor, null, 2);
    jsonSheet.appendRow([new Date(), jsonString]);
    
    Logger.log("Donor added: " + donor.animalName);
    
  } catch (error) {
    Logger.log("Error: " + error.toString());
  }
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
  const donors = [];
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    donors.push({
      date: formatDate(row[0]),
      location: row[1] || "",
      animalName: row[2] || "",
      animalType: row[3] || "",
      age: row[4] || "",
      weight: row[5] || "",
      gender: row[6] || "",
      bloodType: row[7] || "",
      fiv: row[8] || "",
      felv: row[9] || "",
      pcv: row[10] || "",
      hct: row[11] || "",
      wbc: row[12] || "",
      plt: row[13] || "",
      packedCell: row[14] || "",
      slideFindings: row[15] || "",
      donated: row[16] || "",
      volume: row[17] || "",
      notes: row[18] || "",
      isPrivateOwner: row[19] === "Yes",
      ownerName: row[20] || "",
      fileNumber: row[21] || "",
      ownerPhone: row[22] || ""
    });
  }
  
  const jsonSheet = getOrCreateJsonSheet();
  const jsonString = JSON.stringify(donors, null, 2);
  jsonSheet.appendRow([new Date(), jsonString]);
  
  SpreadsheetApp.getUi().alert(`Exported ${donors.length} donors to JSON!`);
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
  const donors = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    donors.push({
      date: formatDate(row[0]),
      location: row[1] || "",
      animalName: row[2] || "",
      animalType: row[3] || "",
      age: row[4] || "",
      weight: row[5] || "",
      gender: row[6] || "",
      bloodType: row[7] || "",
      fiv: row[8] || "",
      felv: row[9] || "",
      pcv: row[10] || "",
      hct: row[11] || "",
      wbc: row[12] || "",
      plt: row[13] || "",
      packedCell: row[14] || "",
      slideFindings: row[15] || "",
      donated: row[16] || "",
      volume: row[17] || "",
      notes: row[18] || "",
      isPrivateOwner: row[19] === "Yes",
      ownerName: row[20] || "",
      fileNumber: row[21] || "",
      ownerPhone: row[22] || ""
    });
  }
  
  const blob = Utilities.newBlob(JSON.stringify(donors, null, 2), 'application/json', 'donors.json');
  DriveApp.createFile(blob);
  
  SpreadsheetApp.getUi().alert('JSON file created in your Google Drive!');
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

**Problem:** JSON format is wrong
- **Solution:** Make sure column order matches the script

**Problem:** Phone validation is too strict
- **Solution:** Remove validation or change to "Text" type

---

## 📞 Need Help?
If anything doesn't work, send me the error message and I'll help fix it!
