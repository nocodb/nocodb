/*const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const MONTHS_SHORT_LOWER = MONTHS_SHORT.map((m) => m.toLowerCase());
const MONTHS_SHORT_UPPER = MONTHS_SHORT.map((m) => m.toUpperCase());

const MONTHS_LOWER = MONTHS.map((m) => m.toLowerCase());
const MONTHS_UPPER = MONTHS.map((m) => m.toUpperCase());*/

const MONTH_FORMATS = {
  MM: '[0-9]{1,2}' /*
  Mon: '(' + MONTHS_SHORT.join('|') + ')',
  MON: '(' + MONTHS_SHORT_UPPER.join('|') + ')',
  mon: '(' + MONTHS_SHORT_LOWER.join('|') + ')',
  Month: '(' + MONTHS.join('|') + ')',
  MONTH: '(' + MONTHS_UPPER.join('|') + ')',
  month: '(' + MONTHS_LOWER.join('|') + ')',*/,
};
/*
 * Map of date formats to their respective regex patterns.
 */
export const DATE_FORMATS = {
  ymd: Object.keys(MONTH_FORMATS).map((format) => [
    `Y-${format}-DD`,
    `^\\d{1,4}[:\\- /]+${MONTH_FORMATS[format]}[:\\- /]+\\d{1,2}$`,
  ]),
  dmy: Object.keys(MONTH_FORMATS).map((format) => [
    `DD-${format}-Y`,
    `^\\d{1,2}[:\\- /]+${MONTH_FORMATS[format]}[:\\- /]+\\d{1,4}$`,
  ]),
  mdy: Object.keys(MONTH_FORMATS).map((format) => [
    `${format}-DD-Y`,
    `^${MONTH_FORMATS[format]}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,4}$`,
  ]),
  empty: [['', '^.*$']],
};

/*
 * Map of date time formats to their respective regex patterns.
 */
export const TIME_FORMATS = [
  [
    'HH24:MI:SS:MS:US',
    '^\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,3}[:\\- /]+\\d*$',
  ],
  [
    'HH24:MI:SS:MS',
    '^\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,3}$',
  ],
  ['HH24:MI:SS', '^\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,2}$'],
  ['HH24:MI', '^\\d{1,2}[:\\- /]+\\d{1,2}$'],
  ['HH24', '^\\d{1,2}$'],
  [
    'HH12:MI:SS:MS:US (AM|PM)',
    '^\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,3}[:\\- /]+\\d* (AM|PM)$',
  ],
  [
    'HH12:MI:SS:MS (AM|PM)',
    '^\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,3} (AM|PM)$',
  ],
  [
    'HH12:MI:SS (AM|PM)',
    '^\\d{1,2}[:\\- /]+\\d{1,2}[:\\- /]+\\d{1,2} (AM|PM)$',
  ],
  ['HH12:MI (AM|PM)', '^\\d{1,2}[:\\- /]+\\d{1,2} (AM|PM)$'],
  ['HH12 (AM|PM)', '^\\d{1,2} (AM|PM)$'],
];
