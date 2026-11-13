/*
 * The shape of a number in text, shared by the text → number casts. Written in
 * the regex syntax JS and PostgreSQL share, without `?` (a knex placeholder).
 */

// Blanks Intl puts around numbers: no-break spaces and bidi marks.
const BLANKS = '\\u00a0\\u202f\\u200e\\u200f\\u061c';
const SPACE = `[\\s${BLANKS}]`;
const SIGN = '[+\\u2212-]';
const NON_ASCII = `[^\\x01-\\x7F${BLANKS}\\u2212]`;

// Latin-letter currency symbols Intl renders, e.g. sv `kr`, id `Rp`, ZA `R`.
const LATIN_SYMBOLS = [
  'kr',
  'kr.',
  'Dkr',
  'Ikr',
  'Nkr',
  'Skr',
  'Ksh',
  'TSh',
  'USh',
  'Rs',
  'Rs.',
  'Rp',
  'RM',
  'KM',
  'FC',
  'FCFA',
  'F CFA',
  'CFPF',
  'FCFP',
  'Cg',
  'Cg.',
  'Br',
  'kn',
  'Ft',
  'din',
  'din.',
  'den',
  'DA',
  'DT',
  'Db',
  'FG',
  'Fdj',
  'FBu',
  'Ar',
  'RF',
  'UM',
  'Cf',
  'CF',
  'SR',
  'Nfk',
  'ZiG',
  'MTn',
  'Kz',
  'Bs',
  'Bs.S',
  'B/.',
  'Gs.',
  'Afl.',
  'NAf.',
  'S/',
  'Le',
  'VT',
  'LS',
  'MK',
].map((s) => s.replace(/[./]/g, '\\$&').replace(' ', SPACE));

// `$`-based (US$, CA$, $US), any token with a non-ASCII character (€, CN¥,
// zł, د.إ.), or a known Latin one.
const SYMBOL = `([A-Za-z]{0,4}\\$[A-Z]{0,2}|[A-Za-z.]{0,4}${NON_ASCII}(${NON_ASCII}|[A-Za-z.]){0,11}|${LATIN_SYMBOLS.join(
  '|',
)})`;
// A real ISO code, or the bare-letter symbols R (ZAR) and Q (GTQ). Any other
// uppercase run is a word or an id: `INV-1001` and `5 KG` are not money.
const CODE = `(${[
  ...Intl.supportedValuesOf('currency'),
  // retired or market-only codes still found in old exports
  ...['EEK', 'LTL', 'LVL', 'VEF', 'BYR', 'MRO', 'STD', 'CNH'],
  'R',
  'Q',
].join('|')})`;
// A code needs a space or a sign after it, so `Q1` is not money.
const PREFIX = `(${SYMBOL}${SPACE}*|${CODE}(${SPACE}+|${SPACE}*${SIGN}${SPACE}*)|%${SPACE}*)`;
const SUFFIX = `(${SPACE}*${SYMBOL}|${SPACE}+${CODE}|${SPACE}*%)`;

// Group separators: `,` with a period decimal, also `.` in any locale.
const PERIOD_GROUP = `,'’ ${BLANKS}`;
const ANY_GROUP = `.${PERIOD_GROUP}`;

// 1,234,567 or Indian 12,34,567.
const grouped = (group: string) =>
  `([0-9]{1,3}([${group}][0-9]{2,3})*[${group}][0-9]{3}|[0-9]+)`;

function shape(number: string) {
  const sign = `(${SIGN}${SPACE}*){0,1}`;
  return `^${SPACE}*${sign}${PREFIX}{0,1}${sign}${number}${SUFFIX}{0,1}(${SPACE}*${SIGN}){0,1}${SPACE}*$`;
}

const EXPONENT = '([eE][+-]{0,1}[0-9]{1,3}){0,1}';

// A period-decimal number, with an optional exponent.
export const NUMERIC_LITERAL_REGEX = shape(
  `(${grouped(PERIOD_GROUP)}(\\.[0-9]*){0,1}|\\.[0-9]+)${EXPONENT}`,
);
// The digits of a NUMERIC_LITERAL_REGEX match, from its first digit.
export const NUMERIC_LITERAL_DIGITS = `(([0-9][0-9${PERIOD_GROUP}]*(\\.[0-9]*){0,1}|\\.[0-9]+)${EXPONENT})`;

// A number in any locale; `nc_parse_locale_number` settles the separators.
export const LOCALE_NUMBER_REGEX = shape(
  `(${grouped(ANY_GROUP)}([.,][0-9]*){0,1}|[.,][0-9]+)`,
);
// The digits and separators of a LOCALE_NUMBER_REGEX match.
export const LOCALE_NUMBER_DIGITS = `([0-9][0-9${ANY_GROUP}]*|[.,][0-9]+)`;

// A minus sign before or after the number.
export const NEGATIVE_REGEX = '^[^0-9]*[\\u2212-]|[\\u2212-][^0-9]*$';

// For a single-quoted SQL literal.
export const sqlRegex = (regex: string) => regex.replace(/'/g, "''");
