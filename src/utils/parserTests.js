// Simple tests for file parser utilities
// Run these tests by opening in browser console or with Node.js

import { normalizeMonth, normalizeProductName, validateFileType, mapFieldNames, validateDataSchema, normalizeDataRow, deduplicateData } from './fileParser.js';

// Test normalizeMonth
console.log('Testing normalizeMonth:');
console.log(normalizeMonth('2025-01-15')); // Expected: '2025-01'
console.log(normalizeMonth('01/15/2025')); // Expected: '2025-01'
console.log(normalizeMonth('invalid')); // Expected: null
console.log(normalizeMonth(null)); // Expected: null

// Test normalizeProductName
console.log('\nTesting normalizeProductName:');
console.log(normalizeProductName('  apple juice  ')); // Expected: 'Apple Juice'
console.log(normalizeProductName('ORANGE    SODA')); // Expected: 'Orange Soda'
console.log(normalizeProductName('')); // Expected: ''
console.log(normalizeProductName(null)); // Expected: ''

// Test validateFileType
console.log('\nTesting validateFileType:');
console.log(validateFileType('data.csv')); // Expected: true
console.log(validateFileType('data.xlsx')); // Expected: true
console.log(validateFileType('data.json')); // Expected: true
console.log(validateFileType('data.txt')); // Expected: false
console.log(validateFileType('data.pdf')); // Expected: false

// Test mapFieldNames
console.log('\nTesting mapFieldNames:');
const rawData = [
  { date: '2025-01-15', product: 'Apple', qty: 10, cost: 5.0 },
  { date: '2025-01-16', product: 'Orange', qty: 15, cost: 3.0 }
];
const mapped = mapFieldNames(rawData);
console.log('Field mapping:', mapped.fieldMap);
console.log('Mapped data sample:', mapped.data[0]);

// Test validateDataSchema
console.log('\nTesting validateDataSchema:');
const validData = [{ date: '2025-01-15', productName: 'Apple', quantity: 10, price: 5.0 }];
const invalidData = [{ date: '2025-01-15', name: 'Apple' }]; // Missing required fields

console.log('Valid data validation:', validateDataSchema(validData));
console.log('Invalid data validation:', validateDataSchema(invalidData));

// Test normalizeDataRow
console.log('\nTesting normalizeDataRow:');
const testRow = { date: '2025-01-15', productName: '  apple juice  ', quantity: '10', price: '5.5' };
const normalizedRow = normalizeDataRow(testRow);
console.log('Normalized row:', normalizedRow);

// Test deduplicateData
console.log('\nTesting deduplicateData:');
const duplicateData = [
  { date: '2025-01-15', productName: 'Apple', quantity: 10, price: 5.0, _key: 'key1' },
  { date: '2025-01-15', productName: 'Apple', quantity: 10, price: 5.0, _key: 'key1' }, // Duplicate
  { date: '2025-01-16', productName: 'Orange', quantity: 15, price: 3.0, _key: 'key2' }
];
const deduplicated = deduplicateData(duplicateData);
console.log('Original length:', duplicateData.length);
console.log('Deduplicated length:', deduplicated.length);

console.log('\nAll parser tests completed!');

// Export for potential use in other test runners
export const runParserTests = () => {
  console.log('Running comprehensive parser tests...');
  
  // Month normalization tests
  const monthTests = [
    { input: '2025-01-15', expected: '2025-01' },
    { input: '01/15/2025', expected: '2025-01' },
    { input: 'invalid', expected: null },
    { input: null, expected: null }
  ];
  
  monthTests.forEach(test => {
    const result = normalizeMonth(test.input);
    const passed = result === test.expected;
    console.log(`normalizeMonth(${test.input}): ${result} ${passed ? '✓' : '✗'}`);
  });
  
  // Product name normalization tests
  const productNameTests = [
    { input: '  apple juice  ', expected: 'Apple Juice' },
    { input: 'ORANGE    SODA', expected: 'Orange Soda' },
    { input: '', expected: '' },
    { input: null, expected: '' }
  ];
  
  productNameTests.forEach(test => {
    const result = normalizeProductName(test.input);
    const passed = result === test.expected;
    console.log(`normalizeProductName(${JSON.stringify(test.input)}): ${JSON.stringify(result)} ${passed ? '✓' : '✗'}`);
  });
  
  console.log('Parser tests completed!');
};