import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import duration from 'dayjs/plugin/duration.js';
import utc from 'dayjs/plugin/utc.js';
import weekday from 'dayjs/plugin/weekday.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(weekday);
dayjs.extend(timezone);

export const dateMonthFormats = ['YYYY-MM', 'YYYY MM'];

export const timeFormats = ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS'];

export const dateFormats = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'DD-MM-YYYY',
  'MM-DD-YYYY',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'DD MM YYYY',
  'MM DD YYYY',
  'YYYY MM DD',
];

export const isDateMonthFormat = (format: string) =>
  dateMonthFormats.includes(format);

export function validateDateWithUnknownFormat(v: string) {
  for (const format of dateFormats) {
    if (dayjs(v, format, true).isValid() as any) {
      return true;
    }
    for (const timeFormat of timeFormats) {
      if (dayjs(v, `${format} ${timeFormat}`, true).isValid() as any) {
        return true;
      }
    }
  }
  return false;
}

export function getDateFormat(v: string) {
  for (const format of dateFormats) {
    if (dayjs(v, format, true).isValid()) {
      return format;
    }
  }
  return 'YYYY/MM/DD';
}

export function getDateTimeFormat(v: string) {
  for (const format of dateFormats) {
    for (const timeFormat of timeFormats) {
      const dateTimeFormat = `${format} ${timeFormat}`;
      if (dayjs(v, dateTimeFormat, true).isValid() as any) {
        return dateTimeFormat;
      }
    }
  }
  return 'YYYY/MM/DD HH:mm';
}

export function parseStringDate(v: string, dateFormat: string) {
  const dayjsObj = dayjs(v);
  if (dayjsObj.isValid()) {
    v = dayjsObj.format('YYYY-MM-DD');
  } else {
    v = dayjs(v, dateFormat).format('YYYY-MM-DD');
  }
  return v;
}

export function parseStringDateTime(
  v: string,
  dateTimeFormat: string = `${dateFormats[0]} ${timeFormats[0]}`,
  toLocal: boolean = true
) {
  const dayjsObj = toLocal ? dayjs(v).local() : dayjs(v);

  if (dayjsObj.isValid()) {
    v = dayjsObj.format(dateTimeFormat);
  } else {
    v = toLocal
      ? dayjs(v, dateTimeFormat).local().format(dateTimeFormat)
      : dayjs(v, dateTimeFormat).format(dateTimeFormat);
  }

  return v;
}

export function convertToTargetFormat(
  v: string,
  oldDataFormat,
  newDateFormat: string
) {
  if (
    !dateFormats.includes(oldDataFormat) ||
    !dateFormats.includes(newDateFormat)
  )
    return v;
  return dayjs(v, oldDataFormat).format(newDateFormat);
}

export const handleTZ = (val: any) => {
  if (val === undefined || val === null) {
    return;
  }
  if (typeof val !== 'string') {
    return val;
  }
  return val.replace(
    // match and extract dates and times in the ISO 8601 format
    /((?:-?(?:[1-9][0-9]*)?[0-9]{4})-(?:1[0-2]|0[1-9])-(?:3[01]|0[1-9]|[12][0-9])T(?:2[0-3]|[01][0-9]):(?:[0-5][0-9]):(?:[0-5][0-9])(?:\.[0-9]+)?(?:Z|[+-](?:2[0-3]|[01][0-9]):[0-5][0-9]))/g,
    (_, v) => {
      return dayjs(v).format('YYYY-MM-DD HH:mm');
    }
  );
};

export function validateDateFormat(v: string) {
  return dateFormats.includes(v);
}

export const timeAgo = (date: any) => {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
    // if there is no timezone info, consider as UTC
    // e.g. 2023-01-01 08:00:00 (MySQL)
    date += '+00:00';
  }
  // show in local time
  return dayjs(date).fromNow();
};

export const isValidTimeFormat = (value: string, format: string) => {
  const regexValidator = {
    [timeFormats[0]]: /^([01]\d|2[0-3]):[0-5]\d$/,
    [timeFormats[1]]: /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/,
    [timeFormats[2]]: /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}$/,
  };

  if (regexValidator[format]) {
    return regexValidator[format].test(value);
  }
  return false;
};
