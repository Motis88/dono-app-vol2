const fs = require('fs');

// Read the JSON file
const filePath = process.argv[2] || 'donor_data.json';
const donors = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log(`Total donors in file: ${donors.length}`);
console.log('='.repeat(80));

// Filter to July-October 2025
const targetMonths = ['2025-07', '2025-08', '2025-09', '2025-10'];
const filtered = donors.filter(d => {
  const month = d.date?.substring(0, 7);
  return targetMonths.includes(month);
});

console.log(`Donors in July-October 2025: ${filtered.length}`);
console.log('='.repeat(80) + '\n');

// Count animals per day+location (like the new algorithm)
const dayLocationCounts = {};
const dayLocationAnimals = {};

filtered.forEach(donor => {
  const date = donor.date;
  const location = donor.location;
  const animalName = donor.animalName || 'Unknown';
  
  if (!date || !location) return;
  
  const key = `${date}_${location}`;
  dayLocationCounts[key] = (dayLocationCounts[key] || 0) + 1;
  
  if (!dayLocationAnimals[key]) {
    dayLocationAnimals[key] = [];
  }
  dayLocationAnimals[key].push(animalName);
});

// Identify real shifts (2+ animals)
const realShifts = Object.entries(dayLocationCounts).filter(([k, v]) => v >= 2);
const singleDonations = Object.entries(dayLocationCounts).filter(([k, v]) => v === 1);

console.log('📊 SHIFT ANALYSIS:');
console.log(`  Total day+location combinations: ${Object.keys(dayLocationCounts).length}`);
console.log(`  Real shifts (2+ animals): ${realShifts.length}`);
console.log(`  Single donations (excluded): ${singleDonations.length}`);
console.log('\n' + '='.repeat(80) + '\n');

// Group by month
const monthlyStats = {};
targetMonths.forEach(m => {
  monthlyStats[m] = {
    shifts: new Set(),
    donations: 0,
    dayLocationCombos: new Set()
  };
});

filtered.forEach(donor => {
  const date = donor.date;
  const location = donor.location;
  
  if (!date || !location) return;
  
  const month = date.substring(0, 7);
  const key = `${date}_${location}`;
  
  monthlyStats[month].dayLocationCombos.add(key);
  monthlyStats[month].donations++;
  
  // Only count as shift if 2+ animals on that day+location
  if (dayLocationCounts[key] >= 2) {
    monthlyStats[month].shifts.add(key);
  }
});

// Display monthly breakdown
targetMonths.forEach(month => {
  const stats = monthlyStats[month];
  const shiftsCount = stats.shifts.size;
  const donationsCount = stats.donations;
  const combosCount = stats.dayLocationCombos.size;
  
  console.log(`📅 ${month}:`);
  console.log(`   Shifts (2+ animals/day): ${shiftsCount}`);
  console.log(`   Total donations: ${donationsCount}`);
  console.log(`   Day+Location combos: ${combosCount}`);
  console.log(`   Avg animals per shift: ${shiftsCount > 0 ? (donationsCount/shiftsCount).toFixed(1) : 0}`);
  console.log();
});

console.log('='.repeat(80) + '\n');

// Show sample single donations that were excluded
if (singleDonations.length > 0) {
  console.log('🔍 SAMPLE SINGLE DONATIONS (NOT counted as shifts):');
  singleDonations.slice(0, 10).forEach(([key, count]) => {
    const [date, ...locationParts] = key.split('_');
    const location = locationParts.join('_');
    const animals = dayLocationAnimals[key];
    console.log(`   ${date} @ ${location}: ${animals[0]}`);
  });
  if (singleDonations.length > 10) {
    console.log(`   ... and ${singleDonations.length - 10} more single donations`);
  }
  console.log();
}

console.log('='.repeat(80) + '\n');

// Show sample real shifts
if (realShifts.length > 0) {
  console.log('✅ SAMPLE REAL SHIFTS (2+ animals, COUNTED):');
  realShifts.slice(0, 15).forEach(([key, count]) => {
    const parts = key.split('_');
    const date = parts[0];
    const location = parts.slice(1).join('_');
    const animals = dayLocationAnimals[key];
    const animalList = animals.slice(0, 3).join(', ') + (animals.length > 3 ? '...' : '');
    console.log(`   ${date} @ ${location}: ${count} animals - ${animalList}`);
  });
  if (realShifts.length > 15) {
    console.log(`   ... and ${realShifts.length - 15} more shifts`);
  }
}
