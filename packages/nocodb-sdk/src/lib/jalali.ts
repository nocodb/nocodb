import type dayjsType from 'dayjs';

/**
 * Jalali (Persian / Solar Hijri) calendar support.
 *
 * This is a purely presentation-layer helper: values continue to be stored as
 * Gregorian dates in the database. The conversion below only affects how a date
 * is rendered (`format`) and how a user-typed Jalali string is parsed back into
 * a Gregorian date.
 *
 * The Gregorian <-> Jalali conversion is the well known jalaali-js algorithm
 * (MIT, Behdad Esfahbod & Roozbeh Pournader) inlined here so we don't pull in an
 * extra runtime dependency.
 */

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error('Invalid Jalaali year ' + jy);
  }

  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd: number;
  let jm: number;
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    } else {
      k -= 186;
    }
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function toJalaali(
  gy: number,
  gm: number,
  gd: number
): { jy: number; jm: number; jd: number } {
  return d2j(g2d(gy, gm, gd));
}

export function toGregorian(
  jy: number,
  jm: number,
  jd: number
): { gy: number; gm: number; gd: number } {
  return d2g(j2d(jy, jm, jd));
}

export function isLeapJalaaliYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaaliYear(jy) ? 30 : 29;
}

export const jalaliMonths = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

// Persian weekday short names, starting from Saturday (the first day of the
// Jalali week).
export const jalaliWeekdaysShort = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/**
 * Date format strings that render a Jalali calendar. The `j`-prefixed tokens are
 * handled by the dayjs plugin below; every other token (weekday, separators) is
 * left to dayjs.
 */
export const jalaliDateFormats = [
  'jYYYY/jMM/jDD',
  'jYYYY-jMM-jDD',
  'jDD/jMM/jYYYY',
  'jDD-jMM-jYYYY',
  'jDD jMMMM jYYYY',
  'jDD jMMM jYYYY',
];

export const jalaliDateMonthFormats = ['jYYYY/jMM', 'jYYYY-jMM'];

const JALALI_TOKEN_REGEX = /jYYYY|jYY|jMMMM|jMMM|jMM|jM|jDD|jD/;

export function isJalaliFormat(format?: string | null): boolean {
  return !!format && JALALI_TOKEN_REGEX.test(format);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Replace Jalali tokens in a dayjs format string with bracket-escaped literal
 * values so the remaining (Gregorian) tokens are still formatted by dayjs.
 * Tokens inside existing `[...]` literal blocks are left untouched.
 */
function buildFormatWithJalali(
  format: string,
  parts: { jy: number; jm: number; jd: number }
): string {
  const { jy, jm, jd } = parts;
  const map: Record<string, string> = {
    jYYYY: String(jy),
    jYY: pad2(jy % 100),
    jMMMM: jalaliMonths[jm - 1],
    jMMM: jalaliMonths[jm - 1],
    jMM: pad2(jm),
    jM: String(jm),
    jDD: pad2(jd),
    jD: String(jd),
  };

  return format.replace(
    /\[([^\]]*)\]|jYYYY|jYY|jMMMM|jMMM|jMM|jM|jDD|jD/g,
    (match, bracketContent) => {
      if (bracketContent !== undefined) return match;
      return '[' + map[match] + ']';
    }
  );
}

/**
 * dayjs plugin that adds Jalali (`j`-prefixed) formatting tokens to `.format()`.
 * The plugin is a no-op for format strings without Jalali tokens.
 */
export const jalaliPlugin = (
  _option: unknown,
  Dayjs: typeof dayjsType.Dayjs
) => {
  const proto = Dayjs.prototype as any;
  const oldFormat = proto.format;
  proto.format = function (formatStr?: string) {
    const str = formatStr || 'YYYY-MM-DDTHH:mm:ssZ';
    if (!JALALI_TOKEN_REGEX.test(str) || !this.isValid()) {
      return oldFormat.call(this, str);
    }
    try {
      const { jy, jm, jd } = toJalaali(
        this.year(),
        this.month() + 1,
        this.date()
      );
      return oldFormat.call(this, buildFormatWithJalali(str, { jy, jm, jd }));
    } catch {
      // The date falls outside the range the Jalali algorithm supports
      // (roughly Gregorian years < 560 or > 3799), where `jalCal` throws.
      // Degrade to Gregorian rendering by stripping the `j` prefixes instead of
      // letting the throw escape — an uncaught error here would break every
      // consumer of `.format()`, including the whole grid render loop.
      return oldFormat.call(
        this,
        str.replace(/j(YYYY|YY|MMMM|MMM|MM|M|DD|D)/g, '$1')
      );
    }
  };
};

/**
 * Parse a user-typed Jalali date string into Gregorian `{ y, m, d }` (1-based
 * month) using the given Jalali format. Returns `null` when the string does not
 * match the format or is not a valid Jalali date.
 */
export function parseJalaliToGregorian(
  input: string,
  format: string
): { y: number; m: number; d: number } | null {
  if (!input || !isJalaliFormat(format)) return null;

  const captured: string[] = [];
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const monthNameAlternation = jalaliMonths
    .map((m) => escapeRegex(m))
    .join('|');

  const regexStr = format.replace(
    /\[([^\]]*)\]|jYYYY|jYY|jMMMM|jMMM|jMM|jM|jDD|jD|[A-Za-z]+|[^A-Za-z]/g,
    (match, bracketContent) => {
      if (bracketContent !== undefined) return escapeRegex(bracketContent);
      if (match === 'jYYYY' || match === 'jYY') {
        captured.push('jy');
        return '(\\d{1,4})';
      }
      if (match === 'jMM' || match === 'jM') {
        captured.push('jm');
        return '(\\d{1,2})';
      }
      if (match === 'jDD' || match === 'jD') {
        captured.push('jd');
        return '(\\d{1,2})';
      }
      if (match === 'jMMMM' || match === 'jMMM') {
        captured.push('jmName');
        return '(' + monthNameAlternation + ')';
      }
      // Any leftover Gregorian letter token is not expected in a Jalali format
      if (/^[A-Za-z]+$/.test(match)) return '.*?';
      return escapeRegex(match);
    }
  );

  const result = new RegExp('^' + regexStr + '$').exec(input.trim());
  if (!result) return null;

  let jy = 0;
  let jm = 0;
  let jd = 0;
  captured.forEach((name, i) => {
    const raw = result[i + 1];
    if (name === 'jy') jy = parseInt(raw, 10);
    else if (name === 'jm') jm = parseInt(raw, 10);
    else if (name === 'jd') jd = parseInt(raw, 10);
    else if (name === 'jmName') jm = jalaliMonths.indexOf(raw) + 1;
  });

  // Month-only Jalali formats (e.g. `jYYYY/jMM`) have no day token, so `jd` is
  // never captured — default it to the 1st so these formats still parse.
  if (!jd && !/jD/.test(format)) jd = 1;

  if (!jy || !jm || !jd || jm < 1 || jm > 12) return null;

  try {
    if (jd < 1 || jd > jalaaliMonthLength(jy, jm)) return null;

    const { gy, gm, gd } = toGregorian(jy, jm, jd);
    return { y: gy, m: gm, d: gd };
  } catch {
    // Out-of-range Jalali year: `jalCal` (via jalaaliMonthLength/toGregorian)
    // throws rather than returning a value. Treat as an unparseable date.
    return null;
  }
}
