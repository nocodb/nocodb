export function convertDateFormat(date_format: string, type: string) {
  if (date_format === 'YYYY-MM-DD') {
    if (type === 'mysql2' || type === 'sqlite') return '%Y-%m-%d';
  } else if (date_format === 'YYYY/MM/DD') {
    if (type === 'mysql2' || type === 'sqlite') return '%Y/%m/%d';
  } else if (date_format === 'DD-MM-YYYY') {
    if (type === 'mysql2' || type === 'sqlite') return '%d/%m/%Y';
  } else if (date_format === 'MM-DD-YYYY') {
    if (type === 'mysql2' || type === 'sqlite') return '%d-%m-%Y';
  } else if (date_format === 'DD/MM/YYYY') {
    if (type === 'mysql2' || type === 'sqlite') return '%d/%m/%Y';
  } else if (date_format === 'MM/DD/YYYY') {
    if (type === 'mysql2' || type === 'sqlite') return '%m-%d-%Y';
  } else if (date_format === 'DD MM YYYY') {
    if (type === 'mysql2' || type === 'sqlite') return '%d %m %Y';
  } else if (date_format === 'MM DD YYYY') {
    if (type === 'mysql2' || type === 'sqlite') return '%m %d %Y';
  } else if (date_format === 'YYYY MM DD') {
    if (type === 'mysql2' || type === 'sqlite') return '%Y %m %d';
  }
  // pg / mssql
  return date_format;
}
