import type { LiteralNode } from 'nocodb-sdk';
import type {
  FnNodeContext,
  FnNodeEstimateContext,
  FnNodeHandlerInterface,
} from '../../fn-handler.interface';

/** `literal` — a constant, bound as `?` except where mssql needs it inlined. */
export class LiteralGeneralHandler implements FnNodeHandlerInterface {
  readonly kind = 'literal' as const;

  async compile(ctx: FnNodeContext): Promise<{ builder: any }> {
    const { knex } = ctx;
    const pt = ctx.pt as LiteralNode;

    // MSSQL: inline string literals as `N'...'` rather than binding `?`.
    //   1. Unicode — a bound string inlines as varchar via `.toQuery()`;
    //      `N'...'` keeps it nvarchar.
    //   2. The single-query (dbQueryClient) path composes this builder into a
    //      larger query and resolves it with one final `.toQuery()`; a bound
    //      `?` placeholder gets consumed/shifted by that outer compilation.
    // Escape any `?` IN THE VALUE itself (e.g. `CONCAT(x, '?')`) to `\?` so
    // the outer `.toQuery()` treats it as a literal, not a binding
    // placeholder. Without this the stray `?` shifts every later binding —
    // e.g. a pk value lands in the `TOP (…)` clause as `TOP ('1')`, which
    // SQL Server rejects with error 1060. The final `.toQuery()` unescapes
    // `\?` back to a literal `?`. (Lookup-of-formula re-escapes after its own
    // `toQuery()`, so the net escaping stays single — see mssql.ts.)
    if (knex.clientType() === 'mssql' && typeof pt.value === 'string') {
      return {
        builder: knex.raw(
          `N'${pt.value.replace(/'/g, "''").replace(/\?/g, '\\?')}'`,
        ),
      };
    }
    if (knex.clientType() === 'mssql' && typeof pt.value === 'boolean') {
      return { builder: knex.raw(pt.value ? '1' : '0') };
    }
    return { builder: knex.raw(`?`, [pt.value]) };
  }

  /** Exact: a literal renders to its own text (mssql adds `N''`). */
  estimate(ctx: FnNodeEstimateContext): number {
    const value = (ctx.pt as { value?: unknown }).value;
    const rendered = typeof value === 'string' ? value : String(value ?? '');
    return rendered.length + (typeof value === 'string' ? 3 : 0);
  }
}
