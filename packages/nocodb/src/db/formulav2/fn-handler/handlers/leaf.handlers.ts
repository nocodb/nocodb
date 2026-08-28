import { FormulaDataTypes } from 'nocodb-sdk';
import type { LiteralNode } from 'nocodb-sdk';
import type {
  FnNodeContext,
  FnNodeHandlerInterface,
} from '../fn-handler.interface';

/**
 * The three leaf node kinds. Grouped in one file because each is a handful of
 * lines of dialect special-casing with no shared state — a file apiece would be
 * more navigation than the content justifies.
 */

/** `literal` — a constant, bound as `?` except where mssql needs it inlined. */
export class LiteralHandler implements FnNodeHandlerInterface {
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
}

/** `identifier` — a column reference, resolved through `aliasToColumn`. */
export class IdentifierHandler implements FnNodeHandlerInterface {
  readonly kind = 'identifier' as const;

  async compile(ctx: FnNodeContext): Promise<{ builder: any }> {
    const { knex, aliasToColumn, tableAlias, parentColumns } = ctx;
    const pt = ctx.pt as FnNodeContext['pt'] & { name: string };

    const { builder } =
      (await aliasToColumn?.[pt.name]?.({
        tableAlias,
        parentColumns,
      })) || {};
    if (typeof builder === 'function') {
      return { builder: knex.raw(`??`, builder(pt.fnName)) };
    }

    if (knex.clientType() === 'databricks' && builder.toQuery().endsWith(')')) {
      // limit 1 for subquery
      return {
        builder: knex.raw(`${builder.toQuery().replace(/\)$/, '')} LIMIT 1)`),
      };
    }

    return { builder: knex.raw(`??`, [builder || pt.name]) };
  }
}

/** `unary_exp` — a prefixed `-`/`+`, folded into the literal where possible. */
export class UnaryExpressionHandler implements FnNodeHandlerInterface {
  readonly kind = 'unary_exp' as const;

  async compile(ctx: FnNodeContext): Promise<{ builder: any }> {
    const { knex, fn, prevBinaryOp } = ctx;
    const pt = ctx.pt as FnNodeContext['pt'] & {
      operator: string;
      argument: any;
    };

    let query;
    if (
      (pt.operator === '-' || pt.operator === '+') &&
      pt.dataType === FormulaDataTypes.NUMERIC
    ) {
      query = knex.raw('?', [
        (pt.operator === '-' ? -1 : 1) *
          ((pt.argument as LiteralNode).value as number),
      ]);
    } else {
      query = knex.raw(
        `${pt.operator}${(
          await fn(pt.argument, pt.operator)
        ).builder.toQuery()}`,
      );
    }

    if (prevBinaryOp && pt.operator !== prevBinaryOp) {
      query.wrap('(', ')');
    }
    return { builder: query };
  }
}
