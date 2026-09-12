import { GeneralDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.general.handler';

// Shared base for dialects whose native formatter takes a single pattern
// string (PostgreSQL `TO_CHAR`, MySQL `DATE_FORMAT`). Each part is mapped to a
// pattern token via `tokens`; literals (and unmapped tokens) are escaped so the
// formatter renders them verbatim. The concrete handler only supplies the token
// map, the literal escaper, and the final function wrapper.
export abstract class PatternDatetimeFormatHandler extends GeneralDatetimeFormatHandler {
  // Day.js token → dialect pattern token.
  protected abstract readonly tokens: Record<string, string>;

  // Escapes a literal run so the formatter emits it verbatim rather than
  // interpreting it as pattern syntax.
  protected abstract escapeLiteral(value: string): string;

  // Wraps the assembled pattern in the dialect's formatting function call.
  protected abstract wrap(dateExpr: string, pattern: string): string;

  build(dateExpr: string, format: string): string {
    const pattern = this.getParts(format)
      .map((p) => {
        if (p.literal) return this.escapeLiteral(p.value);
        // Letter tokens we don't map fall back to literal so the formatter
        // doesn't misinterpret them.
        return this.tokens[p.value] ?? this.escapeLiteral(p.value);
      })
      .join('');

    return this.wrap(dateExpr, pattern);
  }
}
