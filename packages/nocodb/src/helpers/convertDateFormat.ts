import { dateFormats, dateMonthFormats } from 'nocodb-sdk';

const ALLOWED_DATE_FORMATS = new Set([...dateFormats, ...dateMonthFormats]);

const SAFE_DEFAULTS: Record<string, string> = {
  mysql2: '%Y-%m-%d',
  sqlite3: '%Y-%m-%d',
  pg: 'YYYY-MM-DD',
};

export function convertDateFormat(date_format: string, type: string) {
  if (!ALLOWED_DATE_FORMATS.has(date_format)) {
    return SAFE_DEFAULTS[type] ?? SAFE_DEFAULTS.pg;
  }

  if (date_format === 'YYYY-MM-DD') {
    if (type === 'mysql2' || type === 'sqlite3') return '%Y-%m-%d';
  } else if (date_format === 'YYYY/MM/DD') {
    if (type === 'mysql2' || type === 'sqlite3') return '%Y/%m/%d';
  } else if (date_format === 'DD-MM-YYYY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%d/%m/%Y';
  } else if (date_format === 'MM-DD-YYYY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%d-%m-%Y';
  } else if (date_format === 'DD/MM/YYYY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%d/%m/%Y';
  } else if (date_format === 'MM/DD/YYYY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%m-%d-%Y';
  } else if (date_format === 'DD MM YYYY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%d %m %Y';
  } else if (date_format === 'MM DD YYYY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%m %d %Y';
  } else if (date_format === 'YYYY MM DD') {
    if (type === 'mysql2' || type === 'sqlite3') return '%Y %m %d';
  } else if (date_format === 'DD MMM YYYY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%d %b %Y';
  } else if (date_format === 'DD MMM YY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%d %b %y';
  } else if (date_format === 'DD.MM.YYYY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%d.%b.%Y';
  } else if (date_format === 'DD.MM.YY') {
    if (type === 'mysql2' || type === 'sqlite3') return '%d.%b.%y';
  }

  // pg — the format string itself is valid (already allowlisted above)
  return date_format;
}
