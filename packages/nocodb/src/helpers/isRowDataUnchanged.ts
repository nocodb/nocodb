import { isVirtualCol, parseProp, UITypes } from 'nocodb-sdk';
import type { Column } from '~/models';

// Meta keys that only change how stored values are shown. Any other meta change
// (e.g. User `is_multi`, LongText `ai`) may rewrite cells, so clients refetch rows.
// `date_format` is left out: formulas that concatenate a Date format it in SQL.
const DISPLAY_ONLY_META_KEYS = new Set([
  'time_format',
  'is12hrFormat',
  'timezone',
  'isDisplayTimezone',
  'useSameTimezoneForAll',
  'precision',
  'isLocaleString',
  'currency_locale',
  'currency_code',
  'icon',
  'iconIdx',
  'color',
  'max',
  'duration',
  'is_progress',
  'display_type',
  'validate',
  'notify',
  'defaultViewColOrder',
  'defaultViewColVisibility',
]);

function isDisplayOnlyMetaChange(oldMeta: unknown, newMeta: unknown) {
  const before = parseProp(oldMeta) as Record<string, unknown>;
  const after = parseProp(newMeta) as Record<string, unknown>;

  return [...new Set([...Object.keys(before), ...Object.keys(after)])].every(
    (key) =>
      DISPLAY_ONLY_META_KEYS.has(key) ||
      JSON.stringify(before[key]) === JSON.stringify(after[key]),
  );
}

// True only when the update is known not to change any stored or returned cell
// value: a new or recoloured select option, a default value, a description or
// display-only meta. Anything else makes clients refetch rows.
export function isRowDataUnchanged(oldColumn: Column, newColumn: Column) {
  if (!oldColumn || !newColumn) return false;

  if (
    oldColumn.uidt !== newColumn.uidt ||
    oldColumn.title !== newColumn.title ||
    oldColumn.column_name !== newColumn.column_name ||
    oldColumn.dt !== newColumn.dt ||
    oldColumn.dtxs !== newColumn.dtxs
  ) {
    return false;
  }

  // Virtual columns compute their values from colOptions (formula, rollup, lookup, links).
  if (isVirtualCol(newColumn)) return false;

  // A retried attachment cleanup rewrites cells without a type change.
  if (parseProp(oldColumn.internal_meta)?.attachment_cleanup_pending) {
    return false;
  }

  if (!isDisplayOnlyMetaChange(oldColumn.meta, newColumn.meta)) return false;

  if (
    [UITypes.SingleSelect, UITypes.MultiSelect].includes(
      newColumn.uidt as UITypes,
    )
  ) {
    // Match by id: a swap or rename-and-re-add keeps the title set but moves cell values.
    const newTitleById = new Map(
      (newColumn.colOptions?.options ?? []).map((o) => [o.id, o.title]),
    );
    return (oldColumn.colOptions?.options ?? []).every(
      (o) => newTitleById.get(o.id) === o.title,
    );
  }

  return oldColumn.dtxp === newColumn.dtxp;
}
