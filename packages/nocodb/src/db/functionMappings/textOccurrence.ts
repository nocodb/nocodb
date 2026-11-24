import { formulaNumericLiteral, isFormulaInstanceNumber } from 'nocodb-sdk';
import type { MapFnArgs } from '~/db/mapFunctionName';
import { NcError } from '~/helpers/catchError';
import { escapeBindingPlaceholders } from '~/helpers/sqlSanitize';

// TEXTBEFORE / TEXTAFTER / SUBSTITUTE with an instance number. All three cut
// the text at the n-th occurrence of a delimiter (n < 0 counts from the end),
// so each dialect only supplies how to find it.
export interface TextOccurrenceSqlDialect {
  // 1-based start of the n-th occurrence of `delim` in `text`, 0 when there is
  // none. `n` is SQL; `literalN` is its value when the formula gave a constant.
  occurrence(
    text: string,
    delim: string,
    n: string,
    literalN: number | undefined,
  ): string;
  substr(text: string, from: string, length?: string): string;
  length(sql: string): string;
  concat(parts: string[]): string;
  // whether a number has no fractional part
  isWhole(sql: string): string;
  // every occurrence replaced, when plain REPLACE doesn't match case-sensitively
  replaceAll?(text: string, from: string, to: string): string;
  // empty text literal, '' by default
  emptyText?: string;
  // FROM clause a table-less SELECT needs (Oracle: FROM DUAL)
  fromless?: string;
  // keeps the planner from inlining a derived table, which would copy (and
  // re-run) its expressions into every reference (pg: OFFSET 0)
  noInline?: string;
  // no derived row: MySQL 8 can't resolve one whose select list mixes an outer
  // column with another derived table (`Unknown column`), e.g. nested calls
  inlineArgs?: boolean;
}

type OccurrenceRefs = { t: string; d: string; n: string; p: string };

// for dialects that can only find some occurrences (mssql: first and last)
export const assertInstance = (
  literalN: number | undefined,
  allowed: number[],
) => {
  if (literalN === undefined || !allowed.includes(literalN)) {
    NcError.badRequest(
      `The instance argument must be the number ${allowed.join(
        ' or ',
      )}, typed in the formula, on this database`,
    );
  }
};

async function argSql(args: MapFnArgs, index: number) {
  return `(${(await args.fn(args.pt.arguments[index])).builder.toQuery()})`;
}

async function instanceArg(
  dialect: TextOccurrenceSqlDialect,
  args: MapFnArgs,
  index: number,
) {
  const node = args.pt.arguments[index];
  if (!node) return { n: '1', literalN: 1 };
  const literalN = formulaNumericLiteral(node);
  if (literalN === undefined) {
    // a fractional instance is blank everywhere (pg/MySQL round it, SQLite
    // matches nothing, Oracle truncates)
    const n = await argSql(args, index);
    return {
      n: `(CASE WHEN ${dialect.isWhole(n)} THEN ${n} END)`,
      literalN: undefined,
    };
  }
  if (!isFormulaInstanceNumber(literalN)) {
    NcError.badRequest('The instance argument must be a non-zero integer');
  }
  return { n: `(${literalN})`, literalN };
}

// Evaluates text, delimiter and n once (a lookup argument is a correlated
// subquery) in a derived row, with the occurrence computed once above it.
function withOccurrence(
  dialect: TextOccurrenceSqlDialect,
  args: { text: string; delim: string; n: string; literalN?: number },
  body: (refs: OccurrenceRefs) => string,
) {
  if (dialect.inlineArgs) {
    const { text: t, delim: d, n } = args;
    return `(${body({
      t,
      d,
      n,
      p: dialect.occurrence(t, d, n, args.literalN),
    })})`;
  }
  const fromless = dialect.fromless ?? '';
  const noInline = dialect.noInline ?? '';
  const pos = dialect.occurrence(
    'nc_oa.t',
    'nc_oa.d',
    'nc_oa.n',
    args.literalN,
  );
  return `(SELECT ${body({
    t: 'nc_ob.t',
    d: 'nc_ob.d',
    n: 'nc_ob.n',
    p: 'nc_ob.p',
  })} FROM (SELECT nc_oa.t, nc_oa.d, nc_oa.n, ${pos} AS p FROM (SELECT ${
    args.text
  } AS t, ${args.delim} AS d, ${
    args.n
  } AS n${fromless}${noInline}) nc_oa${noInline}) nc_ob)`;
}

const sliceFn =
  (side: 'before' | 'after') =>
  (dialect: TextOccurrenceSqlDialect) =>
  async (args: MapFnArgs) => {
    const text = await argSql(args, 0);
    const delim = await argSql(args, 1);
    const { n, literalN } = await instanceArg(dialect, args, 2);
    const body = (r: OccurrenceRefs) => {
      const slice =
        side === 'before'
          ? dialect.substr(r.t, '1', `${r.p} - 1`)
          : dialect.substr(r.t, `${r.p} + ${dialect.length(r.d)}`);
      // an empty delimiter matches at the start (n > 0) or the end (n < 0)
      const empty = dialect.emptyText ?? `''`;
      const emptyDelim =
        side === 'before'
          ? `CASE WHEN ${r.n} > 0 THEN ${empty} ELSE ${r.t} END`
          : `CASE WHEN ${r.n} > 0 THEN ${r.t} ELSE ${empty} END`;
      return `CASE WHEN ${dialect.length(r.d)} = 0 THEN ${emptyDelim} WHEN ${
        r.p
      } > 0 THEN ${slice} END`;
    };
    return {
      builder: args.knex.raw(
        escapeBindingPlaceholders(
          withOccurrence(dialect, { text, delim, n, literalN }, body),
        ),
      ),
    };
  };

export const textBeforeFn = sliceFn('before');
export const textAfterFn = sliceFn('after');

export const substituteFn =
  (dialect: TextOccurrenceSqlDialect) => async (args: MapFnArgs) => {
    // without an instance it is plain REPLACE
    if (!args.pt.arguments[3]) {
      if (dialect.replaceAll) {
        const [text, from, to] = await Promise.all(
          [0, 1, 2].map((i) => argSql(args, i)),
        );
        return {
          builder: args.knex.raw(
            escapeBindingPlaceholders(dialect.replaceAll(text, from, to)),
          ),
        };
      }
      return args.fn({
        ...args.pt,
        callee: { type: 'Identifier', name: 'REPLACE' },
      });
    }
    const text = await argSql(args, 0);
    const oldText = await argSql(args, 1);
    const newText = await argSql(args, 2);
    const { n, literalN } = await instanceArg(dialect, args, 3);
    const body = (r: OccurrenceRefs) => {
      const replaced = dialect.concat([
        dialect.substr(r.t, '1', `${r.p} - 1`),
        newText,
        dialect.substr(r.t, `${r.p} + ${dialect.length(r.d)}`),
      ]);
      return `CASE WHEN ${dialect.length(r.d)} > 0 AND ${
        r.p
      } > 0 THEN ${replaced} ELSE ${r.t} END`;
    };
    return {
      builder: args.knex.raw(
        escapeBindingPlaceholders(
          withOccurrence(dialect, { text, delim: oldText, n, literalN }, body),
        ),
      ),
    };
  };
