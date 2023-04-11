import dayjs from 'dayjs';

export const dateFormats = [
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

export function validateDateFormat(v: string) {
  return dateFormats.includes(v);
}

export function validateDateWithUnknownFormat(v: string) {
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
    for (const timeFormat of ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS']) {
      const dateTimeFormat = `${format} ${timeFormat}`;
      if (dayjs(v, dateTimeFormat, true).isValid() as any) {
        return dateTimeFormat;
      }
    }
  }
  return 'YYYY/MM/DD';
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

export function convertToTargetFormat(
  v: string,
  oldDataFormat,
  newDateFormat: string,
) {
  if (
    !dateFormats.includes(oldDataFormat) ||
    !dateFormats.includes(newDateFormat)
  )
    return v;
  return dayjs(v, oldDataFormat).format(newDateFormat);
}
