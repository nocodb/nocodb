import type {
  DatetimeFormatHandler,
  FormatPart,
} from '~/db/datetime-format/datetime-format.interface';

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

// Base strategy shared by every dialect handler. Owns the dialect-agnostic
// parsing — localized-preset expansion, tokenization and literal coalescing —
// and leaves the dialect-native rendering to `build()`.
export abstract class GeneralDatetimeFormatHandler
  implements DatetimeFormatHandler
{
  // Recognised Day.js date/time tokens, longest-match-first.
  protected readonly dateTokens = DATE_TOKENS;

  abstract build(dateExpr: string, format: string): string;

  // Splits a format string into literal and token parts. `[...]` escapes a
  // literal run (Day.js convention). `tokens` must contain every token we want
  // to recognise; the longest match at each position wins.
  protected tokenize(format: string, tokens: string[]): FormatPart[] {
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
  protected expandLocalizedFormats(format: string): string {
    const parts = this.tokenize(format, [
      ...Object.keys(LOCALIZED_FORMATS),
      ...this.dateTokens,
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
  protected coalesceLiterals(parts: FormatPart[]): FormatPart[] {
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

  // Full parse pipeline: expand presets, tokenize, then coalesce literal runs.
  protected getParts(format: string): FormatPart[] {
    return this.coalesceLiterals(
      this.tokenize(this.expandLocalizedFormats(format), this.dateTokens),
    );
  }
}
