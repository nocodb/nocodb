import { dateFormats, dateMonthFormats } from 'nocodb-sdk';

const ALLOWED_DATE_FORMATS = new Set([...dateFormats, ...dateMonthFormats]);

const SAFE_DEFAULTS: Record<string, string> = {
  mysql2: '%Y-%m-%d',
  sqlite3: '%Y-%m-%d',
  pg: 'YYYY-MM-DD',
  mssql: 'yyyy-MM-dd',
};

// Weekday-prefixed formats (e.g. 'dddd DD/MM/YYYY') are display-only — the
// weekday name is rendered by dayjs on the frontend and isn't portably
// representable across PG/MySQL/SQLite/MSSQL. Map them to their underlying date
// format so server-side SQL formatting stays correct. See issue #9154.
const WEEKDAY_FORMAT_BASE: Record<string, string> = {
  'dddd YYYY-MM-DD': 'YYYY-MM-DD',
  'ddd YYYY-MM-DD': 'YYYY-MM-DD',
  'dddd DD/MM/YYYY': 'DD/MM/YYYY',
  'ddd DD/MM/YYYY': 'DD/MM/YYYY',
  'dddd MM/DD/YYYY': 'MM/DD/YYYY',
  'ddd MM/DD/YYYY': 'MM/DD/YYYY',
};

export function convertDateFormat(date_format: string, type: string) {
  if (!ALLOWED_DATE_FORMATS.has(date_format)) {
    return SAFE_DEFAULTS[type] ?? SAFE_DEFAULTS.pg;
  }

  date_format = WEEKDAY_FORMAT_BASE[date_format] ?? date_format;

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
  if (type === 'mssql') {
    return date_format.replace(/Y/g, 'y').replace(/D/g, 'd');
  }

  // pg — the format string itself is valid (already allowlisted above)
  return date_format;
}
