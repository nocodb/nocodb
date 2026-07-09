import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import duration from 'dayjs/plugin/duration.js';
import utc from 'dayjs/plugin/utc.js';
import weekday from 'dayjs/plugin/weekday.js';
import timezone from 'dayjs/plugin/timezone.js';
import { ColumnType } from './Api';
import { parseProp } from './helperFunctions';
import { ncIsNull, ncIsUndefined } from './is';
import {
  isJalaliFormat,
  jalaliDateFormats,
  jalaliDateMonthFormats,
  jalaliPlugin,
} from './jalali';

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(weekday);
dayjs.extend(timezone);
dayjs.extend(jalaliPlugin);

export const dateMonthFormats = ['YYYY-MM', 'YYYY MM'];

export const timeFormats = ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS'];

export const dateFormats = [
  // Weekday-prefixed variants are display-only: the weekday name is rendered by
  // dayjs at display time, while values still sort/group on the underlying date.
  // Each pair (full `dddd` + short `ddd`) is placed next to its base format.
  // See issue #9154.
  'YYYY-MM-DD',
  'dddd YYYY-MM-DD',
  'ddd YYYY-MM-DD',
  'YYYY/MM/DD',
  'DD-MM-YYYY',
  'MM-DD-YYYY',
  'DD/MM/YYYY',
  'dddd DD/MM/YYYY',
  'ddd DD/MM/YYYY',
  'MM/DD/YYYY',
  'dddd MM/DD/YYYY',
  'ddd MM/DD/YYYY',
  'DD MM YYYY',
  'MM DD YYYY',
  'YYYY MM DD',
  ///added 2 new format#9652
  'DD MMM YYYY',
  'DD MMM YY',

  // German date notations
  'DD.MM.YYYY',
  'DD.MM.YY',
];

export const isDateMonthFormat = (format: string) =>
  dateMonthFormats.includes(format) || jalaliDateMonthFormats.includes(format);

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
  for (const format of dateFormats.concat(dateMonthFormats)) {
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

// dayjs' customParseFormat plugin only accepts zero-padded month/day/hour/
// minute/second segments when the format string uses the padded tokens (MM,
// DD, HH, ...). Users routinely type or paste unpadded dates (e.g. "5/5/2026"
// for an MM/DD/YYYY column). This returns an unpadded variant of a format
// (MM -> M, DD -> D, ...) so those values parse the same way the padded form
// does. Month-name (MMM/MMMM) and weekday (ddd/dddd) tokens are left untouched.
export function getUnpaddedDateFormat(format: string) {
  return format
    .replace(/(?<!M)MM(?!M)/g, 'M')
    .replace(/(?<!D)DD(?!D)/g, 'D')
    .replace(/(?<!H)HH(?!H)/g, 'H')
    .replace(/(?<!h)hh(?!h)/g, 'h')
    .replace(/(?<!m)mm(?!m)/g, 'm')
    .replace(/(?<!s)ss(?!s)/g, 's');
}

// Parse a date/datetime string against the column's configured format, also
// accepting the same value without zero-padding on month/day/hour/etc. The
// padded format is tried first (non-strict, preserving existing behaviour);
// only if that fails do we retry with the unpadded variant in strict mode, so
// genuinely invalid values (e.g. "hello") are still rejected rather than
// silently coerced.
export function parseDateWithFormat(value: string, format: string) {
  let parsed = dayjs(value, format);

  if (!parsed.isValid()) {
    parsed = dayjs(value, getUnpaddedDateFormat(format), true);
  }

  return parsed;
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
  return (
    dateFormats.includes(v) ||
    jalaliDateFormats.includes(v) ||
    jalaliDateMonthFormats.includes(v)
  );
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

export function constructDateTimeFormat(column: ColumnType) {
  const dateFormat = constructDateFormat(column);
  const timeFormat = constructTimeFormat(column);
  return `${dateFormat} ${timeFormat}`;
}

export function constructDateFormat(column: ColumnType) {
  return parseProp(column?.meta)?.date_format ?? dateFormats[0];
}

export function constructTimeFormat(column: ColumnType) {
  const columnMeta = parseProp(column?.meta);
  const metaTimeFormat = columnMeta.time_format ?? timeFormats[0];
  return columnMeta?.is12hrFormat
    ? metaTimeFormat.replace('HH', 'hh') + ' A' // if 12h, replace HH and add AM/PM at the end
    : metaTimeFormat;
}

export function workerWithTimezone(isEeUI: boolean, timezone?: string) {
  // Check if the timezone is UTC or GMT (case insensitive)
  const isUtcOrGmt = timezone && /^(utc|gmt)$/i.test(timezone);

  return {
    dayjsTz(
      value?: string | number | null | Date | dayjs.Dayjs,
      format?: string
    ) {
      if (!isEeUI) {
        return dayjs(value, format);
      }

      if (ncIsNull(value) || ncIsUndefined(value)) {
        if (timezone) {
          return dayjs.tz(undefined, timezone);
        } else {
          return dayjs();
        }
      } else if (dayjs.isDayjs(value) && value.isValid()) {
        return value;
      }

      if (timezone) {
        if (isUtcOrGmt) {
          const strValue =
            dayjs.isDayjs(value) && value.isValid()
              ? value.toISOString()
              : value;
          return format
            ? dayjs.tz(strValue, format, timezone)
            : dayjs.tz(strValue, timezone);
        } else {
          if (!format) {
            return dayjs.tz(value, timezone);
          } else {
            return dayjs.tz(value, format, timezone);
          }
        }
      } else {
        return dayjs(value, format);
      }
    },

    timezonize(value?: string | number | null | dayjs.Dayjs) {
      if (!isEeUI || !timezone) {
        return dayjs(value);
      }

      if (!value) {
        return this.dayjsTz();
      }

      let dayjsObject: dayjs.Dayjs;

      if (
        typeof value === 'object' &&
        typeof value.isValid === 'function' &&
        value.isValid()
      ) {
        dayjsObject = value.isUTC() ? value : value.utc();
      } else {
        dayjsObject = dayjs.utc(value);
      }

      if (!isEeUI) {
        return dayjsObject.local();
      }

      if (timezone) {
        if (isUtcOrGmt) {
          return dayjs(dayjsObject.toISOString()).tz(timezone);
        } else {
          return dayjsObject.tz(timezone);
        }
      }

      return dayjsObject.local();
    },
  };
}

export const getDateTimeValue = (
  modelValue: string | null,
  col: ColumnType,
  isXcdbBase?: boolean
) => {
  if (!modelValue || !dayjs(modelValue).isValid()) {
    return '';
  }

  const dateFormat = parseProp(col?.meta)?.date_format ?? dateFormats[0];
  const timeFormat = parseProp(col?.meta)?.time_format ?? timeFormats[0];
  const dateTimeFormat = `${dateFormat} ${timeFormat}`;

  if (!isXcdbBase) {
    // For a Jalali date_format the stored value is Gregorian and cannot be
    // parsed with the Jalali format as a mask (customParseFormat has no
    // `j`-token support -> "Invalid Date"). Parse the raw value and let the
    // dayjs Jalali plugin render it via .format().
    if (isJalaliFormat(dateFormat)) {
      return dayjs(modelValue).format(dateTimeFormat);
    }
    return dayjs(
      /^\d+$/.test(modelValue) ? +modelValue : modelValue,
      dateTimeFormat
    ).format(dateTimeFormat);
  }

  return dayjs(modelValue).utc().local().format(dateTimeFormat);
};

export const getDateValue = (
  modelValue: string | null | number,
  col: ColumnType,
  isSystemCol?: boolean
) => {
  const dateFormat = !isSystemCol
    ? parseProp(col.meta)?.date_format ?? 'YYYY-MM-DD'
    : 'YYYY-MM-DD HH:mm:ss';
  if (!modelValue || !dayjs(modelValue).isValid()) {
    return '';
  }
  return dayjs(
    /^\d+$/.test(String(modelValue)) ? +modelValue : modelValue
  ).format(dateFormat);
};

export const newSnapshotTitle = () => {
  return dayjs().format('D MMMM YYYY, h mm A');
};
