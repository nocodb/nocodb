import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import {
  DATE_COMPARE_UNITS,
  FormulaDataTypes,
  getDateFormat,
  getDateTimeFormat,
  JSEPNode,
} from 'nocodb-sdk';
import type { DateCompareUnit } from 'nocodb-sdk';
import type { MapFnArgs } from '~/db/mapFunctionName';
import { isDatetimeInstantNode } from '~/db/functionMappings/commonFns';
import { escapeBindingPlaceholders } from '~/helpers/sqlSanitize';

dayjs.extend(customParseFormat);

// read a literal the way the formula validator accepted it (e.g. DD/MM/YYYY),
// falling back to ISO
export const parseLiteralDate = (value: string) => {
  for (const format of [getDateTimeFormat(value), getDateFormat(value)]) {
    const date = dayjs(value, format, true);
    if (date.isValid()) return date;
  }
  return dayjs(value);
};

// IS_SAME / IS_AFTER / IS_BEFORE. Both sides are cut down to the unit and then
// compared, so each dialect only supplies the truncation.
export interface DateCompareSqlDialect {
  // `sql` truncated to `unit` (full precision when null), as a value whose
  // natural order is time order
  truncate(
    sql: string,
    unit: DateCompareUnit | null,
    dataType?: FormulaDataTypes,
  ): string;
  // datetime literal for a validated `YYYY-MM-DD HH:mm:ss`
  datetimeLiteral(iso: string): string;
  // a comparison as the dialect's scalar boolean, NULL when either side is
  predicate?(sql: string): string;
  // a datetime instant as wall time in the zone TODAY() uses, if not UTC
  localInstant?(sql: string, node: MapFnArgs['pt']): string;
}

async function comparedSide(
  args: MapFnArgs,
  dialect: DateCompareSqlDialect,
  index: number,
  unit: DateCompareUnit | null,
) {
  const node = args.pt.arguments[index];
  if (node.type === JSEPNode.LITERAL) {
    const date = parseLiteralDate(String(node.value ?? ''));
    if (node.value === null || node.value === '' || !date.isValid())
      return 'NULL';
    return dialect.truncate(
      dialect.datetimeLiteral(date.format('YYYY-MM-DD HH:mm:ss')),
      unit,
      FormulaDataTypes.DATE,
    );
  }
  const argNode =
    node.type === JSEPNode.IDENTIFIER ? { ...node, fnName: 'FIRST' } : node;
  const sql = `(${(await args.fn(argNode)).builder.toQuery()})`;
  return dialect.truncate(
    dialect.localInstant && isDatetimeInstantNode(node)
      ? dialect.localInstant(sql, node)
      : sql,
    unit,
    node.dataType as FormulaDataTypes,
  );
}

const compareFn =
  (operator: '=' | '>' | '<') =>
  (dialect: DateCompareSqlDialect) =>
  async (args: MapFnArgs) => {
    const unitNode = args.pt.arguments[2];
    const unit = unitNode ? DATE_COMPARE_UNITS[unitNode.value] ?? null : null;
    const left = await comparedSide(args, dialect, 0, unit);
    const right = await comparedSide(args, dialect, 1, unit);
    const sql = `(${left} ${operator} ${right})`;
    return {
      builder: args.knex.raw(
        escapeBindingPlaceholders(
          dialect.predicate ? dialect.predicate(sql) : sql,
        ),
      ),
    };
  };

export const isSameFn = compareFn('=');
export const isAfterFn = compareFn('>');
export const isBeforeFn = compareFn('<');
