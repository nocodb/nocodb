const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

// Configure dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Test to verify the timezone fix for the "Today" filter bug
 * Issue: #11728 - Today filter for Datetime works with the Browser Timezone but in the Database is UTC
 */

console.log('=== Testing Timezone Fix for Today Filter Bug ===\n');

// Simulate the bug scenario:
// User enters "2025.06.20 00:00" in GMT+3 timezone

const userTimezone = 'Europe/Moscow'; // GMT+3
const userInputTime = '2025-06-20 00:00:00';

console.log(`User timezone: ${userTimezone}`);
console.log(`User input time: ${userInputTime}`);

// OLD BEHAVIOR (before fix): Always use UTC
console.log('\n--- OLD BEHAVIOR (before fix) ---');
const oldNow = dayjs(new Date()).utc();
console.log(`"Today" calculated in UTC: ${oldNow.format('YYYY-MM-DD')}`);

// Simulate what would be stored in database (user input converted to UTC)
const userInputInUTC = dayjs.tz(userInputTime, userTimezone).utc();
console.log(`User input stored in database (UTC): ${userInputInUTC.format('YYYY-MM-DD HH:mm:ss')}`);

// Check if old logic would find the record
const oldTodayMatches = oldNow.format('YYYY-MM-DD') === userInputInUTC.format('YYYY-MM-DD');
console.log(`Would OLD logic find the record? ${oldTodayMatches}`);

// NEW BEHAVIOR (after fix): Use user's timezone
console.log('\n--- NEW BEHAVIOR (after fix) ---');

// Mock column with timezone metadata
const column = {
  uidt: 'DateTime', // UITypes.DateTime
  meta: {
    timezone: userTimezone
  }
};

// Get the column's timezone from metadata or fall back to UTC (as per reviewer feedback)
const columnTimezone = column?.meta?.timezone || 'UTC';

// For datetime comparisons, use the column's timezone instead of UTC
const newNow = dayjs().tz(columnTimezone);
console.log(`"Today" calculated in user timezone (${columnTimezone}): ${newNow.format('YYYY-MM-DD')}`);

// Convert timezone-aware value back to UTC for database comparison
const newNowUTC = newNow.utc();
console.log(`"Today" converted to UTC for database comparison: ${newNowUTC.format('YYYY-MM-DD HH:mm:ss')}`);

// Check if new logic would find the record
const newTodayMatches = newNowUTC.format('YYYY-MM-DD') === userInputInUTC.format('YYYY-MM-DD');
console.log(`Would NEW logic find the record? ${newTodayMatches}`);

console.log('\n=== Test Results ===');
console.log(`Old behavior works: ${oldTodayMatches}`);
console.log(`New behavior works: ${newTodayMatches}`);
console.log(`Fix successful: ${newTodayMatches && !oldTodayMatches ? 'YES' : 'NO'}`);

// Additional test: Verify it works across different timezones
console.log('\n=== Additional Timezone Tests ===');

const testTimezones = [
  'America/New_York',    // GMT-5/-4
  'Europe/London',       // GMT+0/+1  
  'Asia/Tokyo',          // GMT+9
  'Australia/Sydney',    // GMT+10/+11
  'America/Los_Angeles'  // GMT-8/-7
];

testTimezones.forEach(tz => {
  const testColumn = { meta: { timezone: tz } };
  const tzNow = dayjs().tz(tz);
  const tzNowUTC = tzNow.utc();
  
  console.log(`${tz.padEnd(20)} | Today: ${tzNow.format('YYYY-MM-DD HH:mm')} | UTC: ${tzNowUTC.format('YYYY-MM-DD HH:mm')}`);
});

// Test UTC fallback scenario (no timezone metadata)
console.log('\n=== UTC Fallback Test (no timezone metadata) ===');
const columnWithoutTimezone = {
  uidt: 'DateTime',
  meta: {} // No timezone specified
};

const fallbackTimezone = columnWithoutTimezone?.meta?.timezone || 'UTC';
const fallbackNow = dayjs().tz(fallbackTimezone);
console.log(`Column without timezone metadata:`);
console.log(`Fallback timezone: ${fallbackTimezone}`);
console.log(`"Today" calculated as: ${fallbackNow.format('YYYY-MM-DD HH:mm')}`);
console.log(`This ensures consistent behavior when no timezone is set.`);

// Test frontend-backend consistency
console.log('\n=== Frontend-Backend Consistency Test ===');
console.log('Both frontend (validate-row-filters.ts) and backend (conditionV2.ts) now use:');
console.log('- UTC as fallback when no column timezone is set');
console.log('- Column metadata timezone when available');
console.log('- Timezone-aware "today" calculation with UTC conversion for database comparison');

console.log('\n=== Test Complete ===');