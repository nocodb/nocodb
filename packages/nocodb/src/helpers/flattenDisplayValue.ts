import { isLinksOrLTAR } from 'nocodb-sdk';
import type { Column } from '~/models';
import { DISPLAY_VALUE_LINK_MAX_DEPTH } from '~/helpers/displayValueCycle';

/**
 * Text of a record's display value. A link display value is read as a nested record, so this
 * follows it down the linked tables' display values to the first non-link value.
 * Returns null when a link in the chain is empty or the chain is deeper than the cap.
 */
export async function flattenDisplayValue(
  record: Record<string, any> | null | undefined,
  pvColumn: Column | null | undefined,
  customDisplayColumn?: Column | null,
): Promise<any> {
  if (!record || !pvColumn) return null;

  let col: Column = customDisplayColumn ?? pvColumn;
  let value = record[col.title] ?? record[col.id];

  for (let i = 0; i < DISPLAY_VALUE_LINK_MAX_DEPTH; i++) {
    if (Array.isArray(value)) value = value[0];
    if (!isLinksOrLTAR(col) || value == null || typeof value !== 'object') {
      return value ?? null;
    }
    const colOptions = await col.getColOptions<any>();
    const related = await colOptions?.getRelatedTable?.();
    if (!related) return null;
    await related.getColumns();
    const overrideId = colOptions.fk_display_value_column_id;
    col =
      (overrideId && related.columns.find((c) => c.id === overrideId)) ||
      related.displayValue;
    if (!col) return null;
    value = value[col.title] ?? value[col.id];
  }
  return null;
}
