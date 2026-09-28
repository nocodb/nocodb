import {
  getCurrencySymbol,
  getEffectiveLookupColumn,
  getSeparatorChars,
  isArrayShapeLtar,
  parseProp,
  resolveColumnSeparator,
  UITypes,
} from 'nocodb-sdk';
import type { ColumnType } from 'nocodb-sdk';
import type Column from '~/models/Column';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type LookupColumn from '~/models/LookupColumn';

// Excel format codes always spell grouping and decimals as `,` and `.`; Excel
// renders them with the viewer's own regional separators.
const GROUPED = '#,##0';
const UNGROUPED = '0';

// ExcelJS pins `width: 9` on any column carrying a style (Column.toModel) and
// Excel shows `####` when a formatted number does not fit that width.
const MIN_WIDTH = 12;

export interface ExcelNumberFormat {
  numFmt: string;
  width: number;
}

function fraction(precision: number) {
  return precision > 0 ? `.${'0'.repeat(precision)}` : '';
}

// Unquoted, Excel reads a symbol like `$` or `E` as a format token. Only `"`
// needs stripping because `getCurrencySymbol` returns a rendered symbol, never
// arbitrary user text.
function quoted(text: string) {
  return `"${text.replace(/"/g, '')}"`;
}

function widthFor(numFmt: string) {
  return Math.max(MIN_WIDTH, numFmt.length + 4);
}

/**
 * Where the locale puts the currency symbol relative to the number, and whether
 * it separates the two with whitespace.
 */
function symbolPlacement(currencyLocale: string, currencyCode: string) {
  try {
    const parts = new Intl.NumberFormat(currencyLocale, {
      style: 'currency',
      currency: currencyCode,
    }).formatToParts(1) as Array<{ type: string; value: string }>;

    const symbolAt = parts.findIndex((p) => p.type === 'currency');
    const numberAt = parts.findIndex((p) => p.type === 'integer');

    if (symbolAt === -1 || numberAt === -1) return { prefix: true, gap: false };

    const [from, to] =
      symbolAt < numberAt ? [symbolAt, numberAt] : [numberAt, symbolAt];

    return {
      prefix: symbolAt < numberAt,
      gap: parts
        .slice(from + 1, to)
        .some((p) => p.type === 'literal' && /\s/.test(p.value)),
    };
  } catch {
    return { prefix: true, gap: false };
  }
}

function currencyFormat(column: ColumnType): ExcelNumberFormat {
  const meta = parseProp(column.meta);
  const currencyLocale = meta.currency_locale || 'en-US';
  const currencyCode = meta.currency_code || 'USD';

  const number = GROUPED + fraction(meta.precision ?? 2);
  const symbol = quoted(getCurrencySymbol(currencyCode, currencyLocale));
  const { prefix, gap } = symbolPlacement(currencyLocale, currencyCode);
  const space = gap ? ' ' : '';

  const numFmt = prefix
    ? `${symbol}${space}${number}`
    : `${number}${space}${symbol}`;

  return { numFmt, width: widthFor(numFmt) };
}

function decimalFormat(column: ColumnType): ExcelNumberFormat {
  const meta = parseProp(column.meta);
  const { thousandSeparator } = getSeparatorChars(resolveColumnSeparator(meta));

  const numFmt =
    (thousandSeparator ? GROUPED : UNGROUPED) + fraction(meta.precision ?? 1);

  return { numFmt, width: widthFor(numFmt) };
}

/**
 * The Excel number format for a column whose value the xlsx export writes as a
 * number rather than a pre-formatted string. `undefined` for every other type —
 * those keep their serialized string.
 */
export function excelNumberFormat(
  column?: ColumnType,
): ExcelNumberFormat | undefined {
  switch (column?.uidt) {
    case UITypes.Currency:
      return currencyFormat(column);
    case UITypes.Decimal:
      return decimalFormat(column);
    default:
      return undefined;
  }
}

// The column a single-record Lookup renders, display override applied the way
// serializeCellValue does. A multi-record lookup is joined into one text cell,
// so it carries no format.
async function singleRecordLookupTarget(column: Column) {
  const colOptions = await column.getColOptions<LookupColumn>();
  if (!colOptions || colOptions.error) return undefined;

  const relationCol = await colOptions.getRelationColumn();
  if (!relationCol) return undefined;

  await relationCol.getColOptions<LinkToAnotherRecordColumn>();
  if (isArrayShapeLtar(relationCol)) return undefined;

  const lookupColumn = await colOptions.getLookupColumn();
  if (!lookupColumn) return undefined;

  // With an override this is a plain object whose uidt is never Lookup, so
  // `getColOptions` is only ever reached on the real Column instance.
  return getEffectiveLookupColumn(
    parseProp(column.meta),
    lookupColumn,
  ) as Column;
}

/**
 * `excelNumberFormat` for a model column, following a Lookup down to the column
 * it renders so a looked-up currency lands as a numeric cell too.
 */
export async function excelColumnFormat(
  column?: Column,
): Promise<ExcelNumberFormat | undefined> {
  if (column?.uidt !== UITypes.Lookup) return excelNumberFormat(column);

  const target = await singleRecordLookupTarget(column);
  return target && excelColumnFormat(target);
}

// Numeric cell when the serialized value reads as one finite number; anything
// else (blank, a joined multi-value list) is written as it came.
export function excelNumberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return value;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}
