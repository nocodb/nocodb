// Translates a Day.js format string into the equivalent server-side SQL date
// formatting expression for each supported dialect. This powers the
// DATETIME_FORMAT formula function, which lets users render date/datetime
// fields with arbitrary Day.js tokens, including the localized presets
// (LT, LL, LLL, …). See nocodb/nocodb#12545.

// Localized format presets (en locale, matching Day.js' LocalizedFormat
// plugin). Expanded into their underlying token strings before translation so
// the same token map can serve every preset.
const LOCALIZED_FORMATS: Record<string, string> = {
  LTS: 'h:mm:ss A',
  LT: 'h:mm A',
  LLLL: 'dddd, MMMM D, YYYY h:mm A',
  LLL: 'MMMM D, YYYY h:mm A',
  LL: 'MMMM D, YYYY',
  L: 'MM/DD/YYYY',
  llll: 'ddd, MMM D, YYYY h:mm A',
  lll: 'MMM D, YYYY h:mm A',
  ll: 'MMM D, YYYY',
  l: 'M/D/YYYY',
};

// Day.js date/time tokens we recognise (longest-match-first ordering handled by
// the tokenizer). Anything not in this list is treated as literal text.
const DATE_TOKENS = [
  'YYYY',
  'YY',
  'MMMM',
  'MMM',
  'MM',
  'M',
  'Do',
  'DD',
  'D',
  'dddd',
  'ddd',
  'dd',
  'd',
  'HH',
  'H',
  'hh',
  'h',
  'mm',
  'm',
  'ss',
  's',
  'SSS',
  'A',
  'a',
];

interface FormatPart {
  literal: boolean;
  value: string;
}

// Splits a format string into literal and token parts. `[...]` escapes a
// literal run (Day.js convention). `tokens` must contain every token we want to
// recognise; the longest match at each position wins.
function tokenize(format: string, tokens: string[]): FormatPart[] {
  const parts: FormatPart[] = [];
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  let i = 0;

  while (i < format.length) {
    const ch = format[i];

    if (ch === '[') {
      const end = format.indexOf(']', i + 1);
      if (end !== -1) {
        parts.push({ literal: true, value: format.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    let matched = false;
    for (const tok of sorted) {
      if (format.startsWith(tok, i)) {
        parts.push({ literal: false, value: tok });
        i += tok.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      parts.push({ literal: true, value: ch });
      i++;
    }
  }

  return parts;
}

// First pass — expand localized presets (LLL, LT, …) into their underlying
// token strings while keeping real date tokens intact and re-escaping literal
// text so the second pass treats it as literal.
function expandLocalizedFormats(format: string): string {
  const parts = tokenize(format, [
    ...Object.keys(LOCALIZED_FORMATS),
    ...DATE_TOKENS,
  ]);

  return parts
    .map((p) => {
      if (p.literal) return `[${p.value}]`;
      if (LOCALIZED_FORMATS[p.value]) return LOCALIZED_FORMATS[p.value];
      return p.value;
    })
    .join('');
}

// Merge consecutive literal parts into a single run so each dialect can emit
// one quoted literal instead of many adjacent ones (adjacent quoted literals
// are ambiguous in PG's TO_CHAR pattern grammar).
function coalesceLiterals(parts: FormatPart[]): FormatPart[] {
  const merged: FormatPart[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (part.literal && last && last.literal) {
      last.value += part.value;
    } else {
      merged.push({ ...part });
    }
  }
  return merged;
}

function getParts(format: string): FormatPart[] {
  return coalesceLiterals(
    tokenize(expandLocalizedFormats(format), DATE_TOKENS),
  );
}

const MONTHS_FULL = [
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
const MONTHS_ABBR = MONTHS_FULL.map((m) => m.slice(0, 3));
const DAYS_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const DAYS_ABBR = DAYS_FULL.map((d) => d.slice(0, 3));
const DAYS_MIN = DAYS_FULL.map((d) => d.slice(0, 2));

// ---------------------------------------------------------------------------
// PostgreSQL — TO_CHAR pattern string
// ---------------------------------------------------------------------------
const PG_TOKENS: Record<string, string> = {
  YYYY: 'YYYY',
  YY: 'YY',
  MMMM: 'FMMonth',
  MMM: 'Mon',
  MM: 'MM',
  M: 'FMMM',
  Do: 'FMDDth',
  DD: 'DD',
  D: 'FMDD',
  dddd: 'FMDay',
  ddd: 'Dy',
  dd: 'Dy',
  d: 'D',
  HH: 'HH24',
  H: 'FMHH24',
  hh: 'HH12',
  h: 'FMHH12',
  mm: 'MI',
  m: 'FMMI',
  ss: 'SS',
  s: 'FMSS',
  SSS: 'MS',
  A: 'AM',
  a: 'am',
};

function buildPgPattern(format: string): string {
  return getParts(format)
    .map((p) => {
      if (p.literal) return `"${p.value.replace(/["\\]/g, '\\$&')}"`;
      // Letter tokens we don't map fall back to literal so TO_CHAR doesn't
      // misinterpret them.
      return PG_TOKENS[p.value] ?? `"${p.value}"`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// MySQL / MariaDB — DATE_FORMAT pattern string
// ---------------------------------------------------------------------------
const MYSQL_TOKENS: Record<string, string> = {
  YYYY: '%Y',
  YY: '%y',
  MMMM: '%M',
  MMM: '%b',
  MM: '%m',
  M: '%c',
  Do: '%D',
  DD: '%d',
  D: '%e',
  dddd: '%W',
  ddd: '%a',
  dd: '%a',
  d: '%w',
  HH: '%H',
  H: '%k',
  hh: '%h',
  h: '%l',
  mm: '%i',
  m: '%i',
  ss: '%s',
  s: '%s',
  SSS: '%f',
  A: '%p',
  a: '%p',
};

function buildMysqlPattern(format: string): string {
  return getParts(format)
    .map((p) => {
      if (p.literal) return p.value.replace(/%/g, '%%');
      return MYSQL_TOKENS[p.value] ?? p.value.replace(/%/g, '%%');
    })
    .join('');
}

// ---------------------------------------------------------------------------
// SQLite — strftime has no name/12-hour tokens, so build the string piecewise.
// Each emitter returns a scalar SQL expression operating on `d` (the already
// rendered date expression).
// ---------------------------------------------------------------------------
function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// `selector` yields a string key; map it to one of `values` (indexed from
// `start`). `width` matches how strftime pads the key — '%m' is zero-padded to
// 2 digits, '%w' is a single digit.
function caseFromIndex(
  selector: string,
  values: string[],
  start: number,
  width: number,
): string {
  const branches = values
    .map(
      (v, idx) =>
        `WHEN '${String(idx + start).padStart(width, '0')}' THEN ${sqlLiteral(
          v,
        )}`,
    )
    .join(' ');
  return `CASE ${selector} ${branches} ELSE '' END`;
}

function buildSqliteExpr(format: string, d: string): string {
  const hour24 = `cast(strftime('%H', ${d}) as integer)`;
  const hour12 = `(((${hour24} + 11) % 12) + 1)`;
  const monthSel = `strftime('%m', ${d})`;
  const weekdaySel = `strftime('%w', ${d})`;

  const emit: Record<string, string> = {
    YYYY: `strftime('%Y', ${d})`,
    YY: `substr(strftime('%Y', ${d}), -2)`,
    MMMM: caseFromIndex(monthSel, MONTHS_FULL, 1, 2),
    MMM: caseFromIndex(monthSel, MONTHS_ABBR, 1, 2),
    MM: `strftime('%m', ${d})`,
    M: `cast(strftime('%m', ${d}) as integer)`,
    Do: `cast(strftime('%d', ${d}) as integer)`,
    DD: `strftime('%d', ${d})`,
    D: `cast(strftime('%d', ${d}) as integer)`,
    dddd: caseFromIndex(weekdaySel, DAYS_FULL, 0, 1),
    ddd: caseFromIndex(weekdaySel, DAYS_ABBR, 0, 1),
    dd: caseFromIndex(weekdaySel, DAYS_MIN, 0, 1),
    d: `strftime('%w', ${d})`,
    HH: `strftime('%H', ${d})`,
    H: hour24,
    hh: `printf('%02d', ${hour12})`,
    h: hour12,
    mm: `strftime('%M', ${d})`,
    m: `cast(strftime('%M', ${d}) as integer)`,
    ss: `strftime('%S', ${d})`,
    s: `cast(strftime('%S', ${d}) as integer)`,
    SSS: `substr(strftime('%f', ${d}), 4)`,
    A: `CASE WHEN ${hour24} < 12 THEN 'AM' ELSE 'PM' END`,
    a: `CASE WHEN ${hour24} < 12 THEN 'am' ELSE 'pm' END`,
  };

  const pieces = getParts(format).map((p) => {
    if (p.literal) return sqlLiteral(p.value);
    return emit[p.value] ?? sqlLiteral(p.value);
  });

  // `''` keeps the concatenation a TEXT expression even for a single piece.
  return [`''`, ...pieces].join(' || ');
}

export const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm';

export function buildPgDatetimeFormat(
  dateExpr: string,
  format: string,
): string {
  const pattern = buildPgPattern(format).replace(/'/g, "''");
  return `TO_CHAR((${dateExpr})::timestamp, '${pattern}')`;
}

export function buildMysqlDatetimeFormat(
  dateExpr: string,
  format: string,
): string {
  const pattern = buildMysqlPattern(format).replace(/'/g, "''");
  return `DATE_FORMAT(${dateExpr}, '${pattern}')`;
}

export function buildSqliteDatetimeFormat(
  dateExpr: string,
  format: string,
): string {
  return buildSqliteExpr(format, dateExpr);
}
