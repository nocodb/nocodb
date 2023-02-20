import dayjs, { extend } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
extend(customParseFormat);

export function getWeekdayByText(v: string) {
  return {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  }[v?.toLowerCase() || 'monday'];
}

export function getWeekdayByIndex(idx: number): string {
  return {
    0: 'monday',
    1: 'tuesday',
    2: 'wednesday',
    3: 'thursday',
    4: 'friday',
    5: 'saturday',
    6: 'sunday',
  }[idx || 0];
}

export function validateDateWithUnknownFormat(v: string) {
  const dateFormats = [
    'DD-MM-YYYY',
    'MM-DD-YYYY',
    'YYYY-MM-DD',
    'DD/MM/YYYY',
    'MM/DD/YYYY',
    'YYYY/MM/DD',
    'DD MM YYYY',
    'MM DD YYYY',
    'YYYY MM DD',
  ];
  for (const format of dateFormats) {
    if (dayjs(v, format, true).isValid() as any) {
      return true;
    }
    for (const timeFormat of ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS']) {
      if (dayjs(v, `${format} ${timeFormat}`, true).isValid() as any) {
        return true;
      }
    }
  }
  return false;
}
