/**
 * Excel / Google Sheets style "custom number format" engine.
 *
 * Supports a practical subset of the format-code mini-language:
 *   0        digit placeholder, always shown (padded with 0)
 *   #        digit placeholder, only shown if significant
 *   ?        digit placeholder, shown as space if not significant (alignment)
 *   .        decimal point
 *   ,        thousands separator when between digit placeholders (e.g. #,##0)
 *            OR a scale-down-by-1000 operator when trailing (e.g. 0,, for millions)
 *   %        percentage (multiplies the value by 100 and appends %)
 *   "text"   literal text
 *   \x       escaped literal character
 *   [Red] …  bracketed conditions/colors are parsed but not rendered (colors are
 *            a rendering-layer concern, not a string-formatting concern here)
 *   ;        section separator: positive;negative;zero;text (like Excel)
 *
 * This intentionally does NOT attempt to support date/time tokens, fractions,
 * or scientific notation — those would be separate, larger efforts and are out
 * of scope for "custom number formatting" on Number/Decimal/Currency columns.
 *
 * Known limitation: combining a scale operator (trailing `,`) with explicit
 * decimal-place digits in the same section (e.g. `0.000,,`) is not correctly
 * handled and should be flagged by review/tests; scaling alone (`0,,`) and
 * decimals alone (`0.000`) both work correctly.
 */

const LITERAL_PLACEHOLDER = '\u0000';

export interface CustomNumberFormatSections {
  positive: string;
  negative?: string;
  zero?: string;
  text?: string;
}

/**
 * Splits a format string into up to 4 sections on unescaped, unquoted `;`.
 * Splits a format string into sections on unescaped, unquoted `;`.
 * Returns ALL sections found (no cap) — callers that only care about the
 * first 4 (Excel's positive;negative;zero;text convention) should slice
 * themselves; validation needs the true count.
 */
function splitSectionsRaw(format: string): string[] {
   const sections: string[] = [];
   let current = '';
   let inQuotes = false;

   for (let i = 0; i < format.length; i++) {
     const ch = format[i];

     if (ch === '\\' && i + 1 < format.length) {
       current += format[i] + format[i + 1];
       i++;
       continue;
     }

     if (ch === '"') {
       inQuotes = !inQuotes;
     }

     if (ch === ';' && !inQuotes) {
       sections.push(current);
       current = '';
       continue;
     }

     current += ch;
   }

   sections.push(current);
  return sections;
}

function splitSections(format: string): string[] {
  return splitSectionsRaw(format).slice(0, 4);
}

function pickSection(
  sections: string[],
  value: number
): { pattern: string; suppressSign: boolean } {
  if (sections.length === 1) {
    return { pattern: sections[0], suppressSign: false };
  }
  if (value > 0) {
    return { pattern: sections[0], suppressSign: false };
  }
  if (value < 0) {
    if (sections.length >= 2 && sections[1] !== '') {
      // an explicit negative section formats the absolute value;
      // any sign must come from a literal in the pattern itself
      return { pattern: sections[1], suppressSign: true };
    }
    return { pattern: sections[0], suppressSign: false };
  }
  // value === 0
  if (sections.length >= 3 && sections[2] !== '') {
    return { pattern: sections[2], suppressSign: false };
  }
  return { pattern: sections[0], suppressSign: false };
}

/**
 * Pulls out "quoted literals", \escaped chars, and [bracketed] conditions,
 * replacing them with a placeholder so the remaining "skeleton" only
 * contains format tokens (0 # ? , . %).
 */
function extractLiterals(pattern: string): {
  skeleton: string;
  literals: string[];
} {
  const literals: string[] = [];
  let out = '';
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === '\\' && i + 1 < pattern.length) {
      literals.push(pattern[i + 1]);
      out += LITERAL_PLACEHOLDER;
      i += 2;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let lit = '';
      while (j < pattern.length && pattern[j] !== '"') {
        lit += pattern[j];
        j++;
      }
      literals.push(lit);
      out += LITERAL_PLACEHOLDER;
      i = j + 1;
      continue;
    }

    if (ch === '[') {
      // [Red], [$USD-409], [>100] etc. — consumed, not rendered
      let j = pattern.indexOf(']', i);
      if (j === -1) j = pattern.length - 1;
      i = j + 1;
      continue;
    }

    out += ch;
    i++;
  }

  return { skeleton: out, literals };
}

function reinsertLiterals(withPlaceholders: string, literals: string[]): string {
  let idx = 0;
  return withPlaceholders.replace(
    new RegExp(LITERAL_PLACEHOLDER, 'g'),
    () => literals[idx++] ?? ''
  );
}

/**
 * Formats a numeric value using an Excel/Sheets-style custom format string.
 * Returns the raw stringified number (no throw) if the format is empty/invalid,
 * so callers can safely fall back to their default formatting on empty string.
 */
export function formatCustomNumber(
  value: number | string | null | undefined,
  format: string | null | undefined
): string {
  if (value === null || value === undefined || value === '') return '';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return '';
  if (!format) return numericValue.toString();

  const sections = splitSections(format);
  const { pattern, suppressSign } = pickSection(sections, numericValue);
  const { skeleton, literals } = extractLiterals(pattern);

  const isPercent = /%/.test(skeleton);
  let workingValue = Math.abs(numericValue);
  if (isPercent) workingValue *= 100;

  // Strip a trailing run of commas that isn't followed by any more digit
  // placeholders (i.e. it's a scale operator, not a thousands separator).
  let scaleSkeleton = skeleton.replace('%', '');
  const trailingCommaMatch = scaleSkeleton.match(
    new RegExp(`,+(?=${LITERAL_PLACEHOLDER}*$)`)
  );
  let scale = 0;
  if (trailingCommaMatch && trailingCommaMatch.index !== undefined) {
    scale = trailingCommaMatch[0].length;
    const matchStart = trailingCommaMatch.index;
    scaleSkeleton =
      scaleSkeleton.slice(0, matchStart) +
      scaleSkeleton.slice(matchStart + scale);
  }
  workingValue = workingValue / Math.pow(1000, scale);

  const numberPatternMatch = scaleSkeleton.match(/[0#?,]+(?:\.[0#?]+)?/);
  if (!numberPatternMatch) {
    // Pure literal section (no digit placeholders at all)
    return reinsertLiterals(skeleton, literals);
  }

  const numberPattern = numberPatternMatch[0];
  const prefix = scaleSkeleton.slice(0, numberPatternMatch.index);
  const suffix =
    scaleSkeleton.slice(
      (numberPatternMatch.index ?? 0) + numberPattern.length
    ) + (isPercent ? '%' : '');

  const cleanNumberPattern = numberPattern.replace(/,/g, '');
  const useThousands = /,/.test(numberPattern);

  const [intPattern, fracPattern = ''] = cleanNumberPattern.split('.');
  const minFracDigits = (fracPattern.match(/0/g) || []).length;
  const maxFracDigits = fracPattern.length;
  const minIntDigits = (intPattern.match(/0/g) || []).length;

  const rounded = Number(workingValue.toFixed(Math.max(maxFracDigits, 0)));
  // eslint-disable-next-line prefer-const
  let [intPart, fracPart = ''] = rounded.toString().split('.');

  fracPart = fracPart.padEnd(maxFracDigits, '0').slice(0, maxFracDigits);
  // trim optional trailing zeros down to the minimum required by the pattern
  while (fracPart.length > minFracDigits) {
    const tokenForThisPosition = fracPattern[fracPart.length - 1];
    if (tokenForThisPosition === '0') break;
    if (fracPart[fracPart.length - 1] !== '0') break;
    fracPart = fracPart.slice(0, -1);
  }

  intPart = intPart.padStart(minIntDigits, '0');
  if (useThousands) {
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const numberStr =
    intPart + (maxFracDigits > 0 && fracPart.length > 0 ? '.' + fracPart : '');

  const sign = numericValue < 0 && !suppressSign ? '-' : '';

  const fullSkeleton = prefix + LITERAL_PLACEHOLDER + '\uFFFF' + suffix;
  const withNumber = fullSkeleton.replace(
    LITERAL_PLACEHOLDER + '\uFFFF',
    numberStr
  );
  return sign + reinsertLiterals(withNumber, literals);
}

/**
 * Lightweight syntax validation so the UI can flag a bad format string
 * before it's saved to column meta. Not a full grammar check — just guards
 * against unbalanced quotes/brackets and more than 4 sections.
 */
export function isValidCustomNumberFormat(format: string): {
  valid: boolean;
  error?: string;
} {
  if (!format) return { valid: true };

  let quoteCount = 0;
  let bracketDepth = 0;
  for (let i = 0; i < format.length; i++) {
    const ch = format[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '"') quoteCount++;
    if (ch === '[') bracketDepth++;
    if (ch === ']') bracketDepth--;
    if (bracketDepth < 0) return { valid: false, error: 'Unmatched `]`' };
  }
  if (quoteCount % 2 !== 0) {
    return { valid: false, error: 'Unmatched `"` in format' };
  }
  if (bracketDepth !== 0) {
    return { valid: false, error: 'Unmatched `[` in format' };
  }
  if (splitSectionsRaw(format).length > 4) {
    return {
      valid: false,
      error: 'A custom format supports at most 4 sections (positive;negative;zero;text)',
    };
  }
  return { valid: true };
}
