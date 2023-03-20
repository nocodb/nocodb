import { ColumnType, UITypes } from 'nocodb-sdk';

const rowMixedValue = (column: ColumnType, index: number, db?: string) => {
  // Array of country names
  const countries = [
    'Afghanistan',
    'Albania',
    '',
    'Andorra',
    'Angola',
    'Antigua and Barbuda',
    'Argentina',
    null,
    'Armenia',
    'Australia',
    'Austria',
    '',
    null,
  ];

  // Array of sample random paragraphs (comma separated list of cities and countries). Not more than 200 characters
  const longText = [
    'Aberdeen, United Kingdom',
    'Abidjan, Côte d’Ivoire',
    'Abuja, Nigeria',
    '',
    'Addis Ababa, Ethiopia',
    'Adelaide, Australia',
    'Ahmedabad, India',
    'Albuquerque, United States',
    null,
    'Alexandria, Egypt',
    'Algiers, Algeria',
    'Allahabad, India',
    '',
    null,
  ];

  // compute timezone offset
  const offset = new Date().getTimezoneOffset();
  const timezoneOffset =
    (db === 'mysql' ? (offset < 0 ? '+' : '-') : offset <= 0 ? '+' : '-') +
    String(Math.abs(Math.round(offset / 60))).padStart(2, '0') +
    ':' +
    String(Math.abs(offset % 60)).padStart(2, '0');

  // Array of random integers, not more than 10000
  const numbers = [33, null, 456, 333, 267, 34, 8754, 3234, 44, 33, null];
  const decimals = [33.3, 456.34, 333.3, null, 267.5674, 34.0, 8754.0, 3234.547, 44.2647, 33.98, null];
  const duration = [60, 120, 180, 3600, 3660, 3720, null, 3780, 60, 120, null];
  const time = [
    `1999-01-01 02:02:00${timezoneOffset}`,
    `1999-01-01 20:20:20${timezoneOffset}`,
    `1999-01-01 04:04:00${timezoneOffset}`,
    `1999-01-01 02:02:00${timezoneOffset}`,
    `1999-01-01 20:20:20${timezoneOffset}`,
    `1999-01-01 18:18:18${timezoneOffset}`,
    null,
    `1999-01-01 02:02:00${timezoneOffset}`,
    `1999-01-01 20:20:20${timezoneOffset}`,
    `1999-01-01 18:18:18${timezoneOffset}`,
    null,
  ];
  const rating = [0, 1, 2, 3, null, 0, 4, 5, 0, 1, null];
  const years = [2023, null, 1956, 2023, 1967, 2024, 1954, 1924, 2044, 1923, null];

  // Array of random sample email strings (not more than 100 characters)
  const emails = [
    'jbutt@gmail.com',
    'josephine_darakjy@darakjy.org',
    'art@venere.org',
    '',
    null,
    'donette.foller@cox.net',
    'simona@morasca.com',
    'mitsue_tollner@yahoo.com',
    'leota@hotmail.com',
    'sage_wieser@cox.net',
    '',
    null,
  ];

  // Array of random sample phone numbers
  const phoneNumbers = [
    '1-541-754-3010',
    '504-621-8927',
    '810-292-9388',
    '856-636-8749',
    '907-385-4412',
    '513-570-1893',
    '419-503-2484',
    '773-573-6914',
    '',
    null,
  ];

  // Array of random sample URLs
  const urls = [
    'https://www.google.com',
    'https://www.facebook.com',
    'https://www.youtube.com',
    'https://www.amazon.com',
    'https://www.wikipedia.org',
    'https://www.twitter.com',
    'https://www.instagram.com',
    'https://www.linkedin.com',
    'https://www.reddit.com',
    'https://www.tiktok.com',
    'https://www.pinterest.com',
    'https://www.netflix.com',
    'https://www.microsoft.com',
    'https://www.apple.com',
    '',
    null,
  ];

  const singleSelect = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', null];

  const multiSelect = ['jan,feb,mar', 'apr,may,jun', 'jul,aug,sep', 'oct,nov,dec', 'jan,feb,mar', null];

  const checkbox = [true, false, false, true, false, true, false, false, true, true];

  switch (column.uidt) {
    case UITypes.Checkbox:
      return checkbox[index % checkbox.length];
    case UITypes.Number:
    case UITypes.Percent:
      return numbers[index % numbers.length];
    case UITypes.Decimal:
    case UITypes.Currency:
      return decimals[index % decimals.length];
    case UITypes.Duration:
      return duration[index % duration.length];
    case UITypes.Rating:
      return rating[index % rating.length];
    case UITypes.SingleLineText:
      return countries[index % countries.length];
    case UITypes.Email:
      return emails[index % emails.length];
    case UITypes.PhoneNumber:
      return phoneNumbers[index % phoneNumbers.length];
    case UITypes.LongText:
      return longText[index % longText.length];
    case UITypes.Date:
      // set startDate as 400 days before today
      // eslint-disable-next-line no-case-declarations
      const result = new Date();
      result.setDate(result.getDate() - 400 + index);
      return result.toISOString().slice(0, 10);
    case UITypes.URL:
      return urls[index % urls.length];
    case UITypes.SingleSelect:
      return singleSelect[index % singleSelect.length];
    case UITypes.MultiSelect:
      return multiSelect[index % multiSelect.length];
    case UITypes.Year:
      return years[index % years.length];
    case UITypes.Time:
      return time[index % time.length];
    default:
      return `test-${index}`;
  }
};

export { rowMixedValue };
