import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// iCalendar (RFC 5545) line ending is CRLF.
export const ICS_NEWLINE = '\r\n';

/**
 * Escape a value for use in an iCalendar TEXT property (SUMMARY, DESCRIPTION,
 * LOCATION...). Per RFC 5545 §3.3.11 backslash, semicolon and comma must be
 * escaped and newlines represented as the literal `\n`.
 */
export function escapeIcsText(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'object') {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  } else {
    str = String(value);
  }

  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/**
 * Fold a content line to a maximum of 75 octets as required by RFC 5545 §3.1.
 * Continuation lines are prefixed with a single space. Folding is done on an
 * octet (UTF-8 byte) basis so multi-byte characters are never split.
 */
export function foldIcsLine(line: string): string {
  const maxOctets = 75;
  const bytes = Buffer.from(line, 'utf8');

  if (bytes.length <= maxOctets) return line;

  const parts: string[] = [];
  let start = 0;
  let isFirst = true;

  while (start < bytes.length) {
    // First line can hold 75 octets, continuation lines hold 74 (the leading
    // space counts towards the limit).
    const limit = isFirst ? maxOctets : maxOctets - 1;
    let end = Math.min(start + limit, bytes.length);

    // Avoid splitting a multi-byte UTF-8 sequence: continuation bytes match
    // 0b10xxxxxx.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }

    const chunk = bytes.subarray(start, end).toString('utf8');
    parts.push(isFirst ? chunk : ` ${chunk}`);
    start = end;
    isFirst = false;
  }

  return parts.join(ICS_NEWLINE);
}

/**
 * Format a date/datetime cell value as an iCalendar date property value.
 *
 * - All-day (date-only) columns produce a `;VALUE=DATE:YYYYMMDD` parameter+value.
 * - Date-time columns are normalised to UTC and produce a `:YYYYMMDDTHHmmssZ` value.
 *
 * Returns `null` when the value cannot be parsed so the caller can skip the event.
 */
export function formatIcsDate(
  value: unknown,
  isDateOnly: boolean,
): { paramAndValue: string } | null {
  if (value === null || value === undefined || value === '') return null;

  const parsed = isDateOnly
    ? dayjs(value as string)
    : dayjs.utc(value as string);

  if (!parsed.isValid()) return null;

  if (isDateOnly) {
    return { paramAndValue: `;VALUE=DATE:${parsed.format('YYYYMMDD')}` };
  }

  return { paramAndValue: `:${parsed.format('YYYYMMDDTHHmmss')}Z` };
}

/**
 * Add `amount` days to a date/datetime value, preserving the original kind.
 * Used to derive an exclusive DTEND for all-day events (RFC 5545 §3.6.1).
 */
export function shiftIcsDate(
  value: unknown,
  isDateOnly: boolean,
  amount: number,
): string {
  const parsed = isDateOnly
    ? dayjs(value as string)
    : dayjs.utc(value as string);
  return parsed.add(amount, 'day').toISOString();
}

export interface IcsEventInput {
  uid: string;
  dtstamp: string; // ISO string for the export time
  summary?: unknown;
  description?: unknown;
  /** raw cell value of the start column */
  start: unknown;
  /** raw cell value of the end column (optional) */
  end?: unknown;
  /** whether the start column is a date-only (all-day) column */
  startIsDateOnly: boolean;
}

/**
 * Build a single VEVENT block. Returns `null` when the start date is missing or
 * unparseable (an event without a start has no meaning in iCalendar).
 */
export function buildVEvent(event: IcsEventInput): string | null {
  const start = formatIcsDate(event.start, event.startIsDateOnly);

  if (!start) return null;

  const lines: string[] = ['BEGIN:VEVENT'];

  lines.push(foldIcsLine(`UID:${escapeIcsText(event.uid)}`));
  lines.push(`DTSTAMP:${dayjs.utc(event.dtstamp).format('YYYYMMDDTHHmmss')}Z`);
  lines.push(`DTSTART${start.paramAndValue}`);

  // RFC 5545 §3.6.1: DTEND MUST share DTSTART's value type (DATE vs DATE-TIME),
  // so the whole event's all-day-ness is governed by the start column and the
  // end is formatted to match — a timed end on an all-day event keeps only its
  // date, and a date-only end on a timed event is read as midnight.
  const isAllDay = event.startIsDateOnly;

  let end = event.end != null && event.end !== '' ? event.end : null;

  if (isAllDay) {
    // All-day DTEND is exclusive: the day after the last day the event covers.
    // With no explicit end that is start + 1 day; with an explicit end it is
    // that end's date + 1 day so the final day stays included.
    end = shiftIcsDate(end ?? event.start, true, 1);
  }

  if (end != null) {
    const endFormatted = formatIcsDate(end, isAllDay);
    if (endFormatted) {
      lines.push(`DTEND${endFormatted.paramAndValue}`);
    }
  }

  if (event.summary !== undefined && event.summary !== null) {
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(event.summary)}`));
  }

  if (
    event.description !== undefined &&
    event.description !== null &&
    event.description !== ''
  ) {
    lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(event.description)}`));
  }

  lines.push('END:VEVENT');

  return lines.join(ICS_NEWLINE);
}

export function icsCalendarHeader(calendarName?: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NocoDB//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // All event times are emitted as absolute UTC (`Z`); advertise UTC as the
    // calendar's reference timezone. TIMEZONE-ID is the legacy hint and
    // X-WR-TIMEZONE its widely-supported counterpart.
    'TIMEZONE-ID:UTC',
    'X-WR-TIMEZONE:UTC',
  ];

  if (calendarName) {
    // NAME is the RFC 7986 standard property; X-WR-CALNAME is the legacy
    // equivalent many clients still rely on, so emit both.
    lines.push(foldIcsLine(`NAME:${escapeIcsText(calendarName)}`));
    lines.push(foldIcsLine(`X-WR-CALNAME:${escapeIcsText(calendarName)}`));
  }

  return lines.join(ICS_NEWLINE) + ICS_NEWLINE;
}

export const ICS_CALENDAR_FOOTER = `END:VCALENDAR${ICS_NEWLINE}`;
