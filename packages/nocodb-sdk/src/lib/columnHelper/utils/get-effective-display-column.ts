import { ColumnType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';
import { parseProp } from '~/lib/helperFunctions';

export interface DisplayFormatConfig {
  display_type?: UITypes | string | null;
  display_column_meta?: any;
}

/**
 * Build the "effective" column used to render/parse a value when a column carries
 * display-type formatting (Formula / Rollup / Lookup `meta.display_type`).
 *
 * - `config` supplies `display_type` + `display_column_meta`. Pass the column's
 *   parsed `meta` (SDK / Vue) or its canvas `extra` object (canvas) — both expose
 *   the same keys.
 * - `baseColumn` is the column whose other properties (id, title, colOptions, …)
 *   are kept while its `uidt`/`meta` are overridden. For Formula it is omitted
 *   (the value is rendered purely as the display type); for Lookup/Rollup it is the
 *   resolved child column so its identity is preserved.
 *
 * Returns `baseColumn` untouched when no `display_type` is configured, so callers
 * can use it unconditionally and get inherit-by-default behaviour.
 */
export function getEffectiveDisplayColumn(
  config: DisplayFormatConfig | null | undefined,
  baseColumn: Partial<ColumnType> = {}
): ColumnType {
  if (!config?.display_type) return baseColumn as ColumnType;

  return {
    ...baseColumn,
    uidt: config.display_type,
    ...parseProp(config.display_column_meta),
  } as ColumnType;
}
