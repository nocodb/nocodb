import { DATETIME_FORMAT_PRESETS, DATETIME_FORMAT_TOKENS } from 'nocodb-sdk';
import type {
  DatetimeFormatHandler,
  FormatPart,
} from '~/db/datetime-format/datetime-format.interface';

// a single-quoted SQL string literal
export const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

// Base strategy shared by every dialect handler. Owns the dialect-agnostic
// parsing — localized-preset expansion, tokenization and literal coalescing —
// and leaves the dialect-native rendering to `build()`.
export abstract class GeneralDatetimeFormatHandler
  implements DatetimeFormatHandler
{
  // Recognised Day.js date/time tokens, longest-match-first.
  protected readonly dateTokens = DATETIME_FORMAT_TOKENS;

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
      ...Object.keys(DATETIME_FORMAT_PRESETS),
      ...this.dateTokens,
    ]);

    return parts
      .map((p) => {
        if (p.literal) return `[${p.value}]`;
        if (DATETIME_FORMAT_PRESETS[p.value])
          return DATETIME_FORMAT_PRESETS[p.value];
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
