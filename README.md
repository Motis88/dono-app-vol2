# Dono App Vol2

## About the Application
Dono App Vol2 is designed to help organizations and individuals efficiently manage blood donation processes for animals.  
The application streamlines donor tracking, donation management, and overall workflow, providing a user-friendly experience for all users.

## Goals
- **Efficient Donation Management:** Easily track donors and donations in one place.
- **Improvement-Oriented:** Flexible design for future upgrades and enhancements.
- **User-Friendly Experience:** Clear navigation and intuitive interface.

## Future Improvements
- Advanced analytics and reporting tools.
- Automated notifications for donors and administrators.
- Enhanced security and privacy features.
- Multi-language support and improved accessibility.

## Notes and Recommendations
- Regularly review the codebase for optimization opportunities.
- Keep dependencies up to date for better security and performance.
- Encourage user feedback to improve usability and add new features.

---

## Installation and Running

1. Install dependencies:
   ```
   npm install
   ```
2. Start the application:
   ```
   npm start
   ```

## Importing JSON Files

You can import donor lists in JSON format using the "Table By Location" tab.  
Make sure your JSON file matches the required structure (see example below).

### Example Donor Object Structure:
```json
{
  "date": "2025-08-30",
  "location": "Tel Aviv",
  "animalName": "Rex",
  "age": "5",
  "weight": "22",
  "gender": "Male",
  "animalType": "Dog",
  "bloodType": "DEA 1.1+",
  "fiv": "",
  "felv": "",
  "pcv": "45",
  "hct": "42",
  "wbc": "8",
  "plt": "200",
  "packedCell": "1",
  "slideFindings": "",
  "donated": "Yes",
  "volume": "450",
  "notes": "",
  "isPrivateOwner": false
}
```

## Additional Information

- For questions and support:
