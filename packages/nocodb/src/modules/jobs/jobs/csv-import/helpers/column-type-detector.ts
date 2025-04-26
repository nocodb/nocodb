import { UITypes } from 'nocodb-sdk';

/**
 * Detect the column type based on a value
 */
export function detectColumnType(value: any): UITypes {
  if (value === null || value === undefined || value === '') {
    return UITypes.SingleLineText;
  }

  // Check if it's a number
  if (!isNaN(Number(value)) && !isNaN(parseFloat(value))) {
    // Check if it's a decimal
    if (value.toString().includes('.')) {
      return UITypes.Decimal;
    }
    return UITypes.Number;
  }

  // Check if it's a date
  if (isDate(value)) {
    return UITypes.DateTime;
  }

  // Check if it's a boolean
  if (isBoolean(value)) {
    return UITypes.Checkbox;
  }

  // Check if it's an email
  if (isEmail(value)) {
    return UITypes.Email;
  }

  // Check if it's a URL
  if (isUrl(value)) {
    return UITypes.URL;
  }

  // Check if it's a multi-line text
  if (isMultiLineText(value)) {
    return UITypes.LongText;
  }

  // Default to single line text
  return UITypes.SingleLineText;
}

/**
 * Get the most likely column type based on detected types
 */
export function getPossibleUidt(detectedTypes: Record<string, number>): UITypes {
  const len = Object.keys(detectedTypes).length;
  
  // All records are null
  if (len === 0) {
    return UITypes.SingleLineText;
  }
  
  // Handle numeric case
  if (len === 2 && UITypes.Number in detectedTypes && UITypes.Decimal in detectedTypes) {
    return UITypes.Decimal;
  }
  
  // If there are multiple detected column types
  // then return either LongText or SingleLineText
  if (len > 1) {
    if (UITypes.LongText in detectedTypes) {
      return UITypes.LongText;
    }
    return UITypes.SingleLineText;
  }
  
  // Otherwise, all records have the same column type
  return Object.keys(detectedTypes)[0] as UITypes;
}

/**
 * Check if a value is a date
 */
function isDate(value: string): boolean {
  // Try to parse the date
  const date = new Date(value);
  return !isNaN(date.getTime()) && 
    // Exclude numbers that could be parsed as dates
    !/^\d+$/.test(value);
}

/**
 * Check if a value is a boolean
 */
function isBoolean(value: string): boolean {
  const lowerValue = value.toLowerCase();
  return ['true', 'false', 'yes', 'no', '0', '1', 'y', 'n'].includes(lowerValue);
}

/**
 * Check if a value is an email
 */
function isEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if a value is a URL
 */
function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a value is multi-line text
 */
function isMultiLineText(value: string): boolean {
  return value.includes('\n') || value.length > 255;
}
