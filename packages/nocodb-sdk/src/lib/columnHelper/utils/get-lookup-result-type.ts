import { ColumnType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';
import { FormulaDataTypes } from '~/lib/formula/enums';
import { parseProp } from '~/lib/helperFunctions';
import { resolveLookupLeafColumn } from './get-lookup-column-type';
import {
  DisplayFormatConfig,
  getEffectiveDisplayColumn,
} from './get-effective-display-column';

// Number result types whose stored value IS the number shown — reformatting them as
// Decimal/Currency/Percent only changes presentation, never the meaning.
// Duration is intentionally excluded: it is stored as seconds/ms but displayed as
// hh:mm:ss, so reformatting the raw stored value (e.g. 7200) as Currency/Decimal would
// misrepresent it ($7,200.00 instead of 2:00:00). Duration lookups keep their native format.
const lookupNumberResultTypes = new Set<UITypes>([
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Rating,
  UITypes.AutoNumber,
  UITypes.Year,
]);

/**
 * Display-type options offered on the Lookup "Formatting" tab for a given resolved
 * result type. Mirrors Airtable: only number and date result types are formattable.
 *
 * Date-category options are restricted to what the source value can actually
 * satisfy — cross-converting between date and time is meaningless and renders
 * broken output:
 *   - a Date has no time   -> formatting as DateTime/Time yields 00:00
 *   - a Time has no date   -> formatting as Date/DateTime yields today/blank
 * So a Date offers only Date, a Time offers only Time, and only a DateTime (and the
 * read-only Created/LastModified time, which carry both) offer all three.
 */
export function getUITypesForLookupResultType(
  resultType: UITypes | null | undefined
): UITypes[] {
  if (!resultType) return [];

  if (lookupNumberResultTypes.has(resultType)) {
    return [UITypes.Decimal, UITypes.Currency, UITypes.Percent];
  }

  switch (resultType) {
    case UITypes.Date:
      return [UITypes.Date];
    case UITypes.Time:
      return [UITypes.Time];
    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      return [UITypes.Date, UITypes.DateTime, UITypes.Time];
    default:
      return [];
  }
}

function formulaDataTypeToUIType(
  dataType: FormulaDataTypes | undefined
): UITypes {
  switch (dataType) {
    case FormulaDataTypes.NUMERIC:
      return UITypes.Decimal;
    case FormulaDataTypes.DATE:
      return UITypes.Date;
    case FormulaDataTypes.BOOLEAN:
    case FormulaDataTypes.COND_EXP:
      return UITypes.Checkbox;
    case FormulaDataTypes.STRING:
    default:
      return UITypes.SingleLineText;
  }
}

/**
 * Resolve a column's effective "result type", unwrapping computed columns:
 * - Formula -> its `display_type`, else its `parsed_tree.dataType` mapped to a UIType
 * - Rollup  -> numeric (v1: Decimal; rollups are overwhelmingly numeric)
 * - everything else -> its own uidt
 */
export function getColumnResultType(
  column: ColumnType | null | undefined
): UITypes | null {
  if (!column?.uidt) return null;

  switch (column.uidt) {
    case UITypes.Formula: {
      const colMeta = parseProp(column.meta);
      if (colMeta?.display_type) return colMeta.display_type as UITypes;
      return formulaDataTypeToUIType(
        (column.colOptions as any)?.parsed_tree?.dataType
      );
    }
    case UITypes.Rollup: {
      // v1: rollups are treated as numeric. (Edge case: min/max of a date column
      // is a date result — refine if needed.)
      return UITypes.Decimal;
    }
    default:
      return column.uidt as UITypes;
  }
}

/**
 * Resolve the result type of a Lookup column for the Formatting tab — follows the
 * relation + nested-lookup chain to the leaf column, then unwraps Formula/Rollup.
 */
export function getLookupResultType(params: {
  col: ColumnType;
  meta: { columns?: ColumnType[]; base_id?: string };
  metas: Record<string, any>;
  baseId?: string;
  visitedIds?: Set<string>;
}): UITypes | null {
  return getColumnResultType(resolveLookupLeafColumn(params));
}

/**
 * Build the effective display column for a Lookup, applying the saved
 * `meta.display_type` override ONLY when it is still valid for the child's CURRENT
 * result type. If the looked-up field's type later changes (e.g. Number -> Text, or
 * the relation is re-pointed) so the override no longer applies, the override is
 * ignored and the child column renders natively — preventing a stale override from
 * producing blank/NaN output at render or on export. This guards every apply-site
 * (SDK parse, canvas, virtual cell, dataUtils, backend serialize) in one place.
 *
 * Computed children (Lookup/Formula/Rollup) are treated permissively: their true leaf
 * result type can't always be resolved from the child column alone (e.g. unloaded
 * colOptions on the backend, or a nested lookup), so the override is applied for them
 * as before rather than risk dropping a valid override.
 */
export function getEffectiveLookupColumn(
  config: DisplayFormatConfig | null | undefined,
  childColumn: ColumnType
): ColumnType {
  if (!childColumn || !config?.display_type) return childColumn;

  const isComputedChild = [
    UITypes.Lookup,
    UITypes.Formula,
    UITypes.Rollup,
  ].includes(childColumn.uidt as UITypes);

  const stillApplicable =
    isComputedChild ||
    getUITypesForLookupResultType(getColumnResultType(childColumn)).includes(
      config.display_type as UITypes
    );

  return stillApplicable
    ? getEffectiveDisplayColumn(config, childColumn)
    : childColumn;
}
