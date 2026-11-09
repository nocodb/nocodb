const CALENDAR_DATE_PARAMS = [
  'from_date',
  'to_date',
  'prev_date',
  'next_date',
] as const;

type CalendarDateParams = Partial<
  Record<(typeof CALENDAR_DATE_PARAMS)[number], string>
>;

/**
 * Error message naming the calendar range params missing from `param`.
 */
export function missingCalendarDateParamsMessage(param: CalendarDateParams) {
  const missing = CALENDAR_DATE_PARAMS.filter((key) => !param[key]);
  return `${missing.join(', ')} ${
    missing.length === 1 ? 'is' : 'are'
  } required`;
}
