import UITypes from '~/lib/UITypes';
import type { ColumnType } from '~/lib/Api';

const DEFAULT_MAX_DEPTH = 3;

/**
 * Column info for record transformation & UI rendering.
 * All properties exist on ColumnType from the SDK.
 */
export type RecordColumnMeta = Pick<
  ColumnType,
  | 'id'
  | 'title'
  | 'column_name'
  | 'uidt'
  | 'pk'
  | 'pv'
  | 'system'
  | 'order'
  | 'meta'
>;

/**
 * Model metadata — table-level info for record transformation & UI rendering.
 * Keyed by model/table ID in `modelMap`.
 */
export interface ModelMeta {
  id: string;
  title: string;
  primaryKeys: RecordColumnMeta[];
  columns: RecordColumnMeta[];
}

/**
 * V3 record format: { id, fields }
 */
export interface DataRecordV3 {
  id?: string | number | null;
  id_fields?: Record<string, any>;
  fields: Record<string, any>;
}

// ─── Primary Key Helpers ────────────────────────────────────────────

/**
 * Extract composite primary key value from a V2 record.
 *
 * SDK-safe version of the backend's `getCompositePkValue`.
 * Does NOT throw — returns `undefined` when the row is missing.
 */
export function getCompositePkValue(
  primaryKeys: RecordColumnMeta[],
  row: any,
  option?: { useColumnId?: boolean }
): string | number | undefined {
  if (row == null) return undefined;
  if (typeof row !== 'object') return row;

  const key: 'id' | 'title' = option?.useColumnId ? 'id' : 'title';

  if (primaryKeys.length > 1) {
    return primaryKeys
      .map((c) =>
        (row[c[key]!] ?? row[c.column_name!])
          ?.toString?.()
          .replaceAll('_', '\\_')
      )
      .join('___');
  }

  return (
    primaryKeys[0] &&
    (row[primaryKeys[0][key]!] ?? row[primaryKeys[0].column_name!])
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────

/**
 * Resolve a column's related model from the two-map structure.
 * Works for LTAR, Links, Lookup, and Rollup columns.
 */
function resolveRelatedModel(
  columnId: string,
  columnModelMap?: Record<string, string>,
  modelMap?: Record<string, ModelMeta>
): ModelMeta | undefined {
  const modelId = columnModelMap?.[columnId];
  return modelId ? modelMap?.[modelId] : undefined;
}

// ─── V2 → V3 ───────────────────────────────────────────────────────

export interface RecordV2ToV3Options {
  /** Primary key columns of the table. */
  primaryKeys: RecordColumnMeta[];
  /** All columns of the table (needed for LTAR detection). */
  columns?: RecordColumnMeta[];
  /** Only include these fields (by id or title). PK is always extracted. */
  requestedFields?: string[];
  /** When true, keys are column ids instead of titles. */
  useColumnId?: boolean;
  /** Treat Links columns like LTAR (expand nested records). */
  linksAsLtar?: boolean;
  /**
   * Model metadata keyed by model/table ID.
   * Contains PKs and columns for each related model.
   */
  modelMap?: Record<string, ModelMeta>;
  /**
   * Maps column ID → related model ID.
   * Covers LTAR, Links, Lookup, and Rollup columns.
   */
  columnModelMap?: Record<string, string>;
  /** Cap nested arrays to this many items. */
  nestedLimit?: number;
  /** Current recursion depth (internal — callers should omit). */
  depth?: number;
  /** Maximum recursion depth for LTAR nesting (default 3). */
  maxDepth?: number;
}

/**
 * Convert a single V2 flat record to V3 `{ id, fields }` format.
 *
 * Handles:
 * - PK extraction → root `id` (single & composite)
 * - Field selection via `requestedFields`
 * - LTAR / Links nested record recursion with depth limiting
 */
export function recordV2ToV3(
  record: Record<string, any>,
  options: RecordV2ToV3Options
): DataRecordV3 {
  const {
    primaryKeys,
    columns,
    requestedFields,
    useColumnId = false,
    linksAsLtar = false,
    modelMap,
    columnModelMap,
    nestedLimit,
    depth = 0,
    maxDepth = DEFAULT_MAX_DEPTH,
  } = options;

  const getKey = (col: RecordColumnMeta) =>
    useColumnId ? col.id! : col.title!;
  const pkTitles = primaryKeys.map(getKey);

  const shouldIncludeField = (fieldKey: string): boolean => {
    // PK fields are never in `fields` — they go to root `id`
    if (pkTitles.includes(fieldKey)) return false;
    if (!requestedFields) return true;
    if (requestedFields.includes(fieldKey)) return true;
    if (columns) {
      const found = columns.find(
        (c) => c.title === fieldKey || c.id === fieldKey
      );
      if (found) {
        return (
          requestedFields.includes(found.id!) ||
          requestedFields.includes(found.title!)
        );
      }
    }
    return false;
  };

  const isLtarColumn = (col: RecordColumnMeta): boolean => {
    return (
      col.uidt === UITypes.LinkToAnotherRecord ||
      (col.uidt === UITypes.Links && linksAsLtar)
    );
  };

  const transformedFields: Record<string, any> = {};

  for (const [key, value] of Object.entries(record)) {
    if (!shouldIncludeField(key)) continue;

    // Handle LTAR / Links nested records
    if (columns) {
      const column = columns.find((col) => col.title === key || col.id === key);
      if (column && isLtarColumn(column)) {
        const related = resolveRelatedModel(
          column.id!,
          columnModelMap,
          modelMap
        );

        if (Array.isArray(value)) {
          // At max depth, return simplified { id } stubs
          if (depth >= maxDepth) {
            transformedFields[key] = value.map((nested) => {
              if (typeof nested === 'object' && nested !== null) {
                const id =
                  nested.id ||
                  nested.Id ||
                  nested.ID ||
                  Object.values(nested)[0];
                return { id: id != null ? String(id) : null };
              }
              return { id: nested != null ? String(nested) : null };
            });
            continue;
          }

          if (related) {
            const items =
              nestedLimit && value.length > nestedLimit
                ? value.slice(0, nestedLimit)
                : value;
            transformedFields[key] = items.map((nested) =>
              recordV2ToV3(nested, {
                ...options,
                primaryKeys: related.primaryKeys,
                columns: related.columns,
                depth: depth + 1,
              })
            );
          }
        } else if (value && typeof value === 'object' && related) {
          // Single record (BT / OO)
          transformedFields[key] = recordV2ToV3(value as Record<string, any>, {
            ...options,
            primaryKeys: related.primaryKeys,
            columns: related.columns,
            depth: depth + 1,
          });
        } else if (value == null) {
          // Unlinked BT / OO — preserve null
          transformedFields[key] = null;
        }

        // Skip LTAR fields with missing related meta — don't pass raw nested data
        continue;
      }
    }

    // Non-LTAR fields — copy as-is
    transformedFields[key] = value;
  }

  const id = getCompositePkValue(primaryKeys, record, { useColumnId });

  // Build id_fields with individual PK values
  const id_fields: Record<string, any> = {};
  for (const pk of primaryKeys) {
    const key = getKey(pk);
    id_fields[key] =
      record[pk.title!] ?? record[pk.column_name!] ?? record[pk.id!];
  }

  return { id, id_fields, fields: transformedFields };
}

/**
 * Convert multiple V2 records to V3 format.
 */
export function recordsV2ToV3(
  records: Record<string, any>[],
  options: RecordV2ToV3Options
): DataRecordV3[] {
  return records.map((record) => recordV2ToV3(record, options));
}

// ─── V3 → V2 ───────────────────────────────────────────────────────

export interface RecordV3ToV2Options {
  /** Primary key columns — used to restore PK fields from root `id`. */
  primaryKeys?: RecordColumnMeta[];
  /** When true, PK fields are keyed by column id instead of title. */
  useColumnId?: boolean;
  /** All columns (needed for LTAR detection in reverse). */
  columns?: RecordColumnMeta[];
  /** Treat Links as LTAR when reversing nested records. */
  linksAsLtar?: boolean;
  /** Model metadata keyed by model/table ID. */
  modelMap?: Record<string, ModelMeta>;
  /** Maps column ID → related model ID. */
  columnModelMap?: Record<string, string>;
}

/**
 * Convert a V3 `{ id, fields }` record back to V2 flat format.
 *
 * Restores PK fields from root `id` and flattens `fields` into the record.
 * Optionally reverses LTAR nesting when `columns` + `modelMap` are provided.
 */
export function recordV3ToV2(
  record: DataRecordV3,
  options?: RecordV3ToV2Options
): Record<string, any> {
  const {
    primaryKeys,
    useColumnId = false,
    columns,
    linksAsLtar = false,
    modelMap,
    columnModelMap,
  } = options || {};

  const result: Record<string, any> = {};

  // Restore PK fields from root `id`
  if (primaryKeys?.length && record.id != null) {
    const getKey = (col: RecordColumnMeta) =>
      useColumnId ? col.id! : col.title!;

    if (primaryKeys.length > 1 && typeof record.id === 'string') {
      // Composite PK — split by ___ separator
      const parts = record.id.split('___').map((p) => p.replaceAll('\\_', '_'));
      primaryKeys.forEach((pk, i) => {
        result[getKey(pk)] = parts[i];
      });
    } else {
      result[getKey(primaryKeys[0])] = record.id;
    }
  }

  // Flatten fields
  for (const [key, value] of Object.entries(record.fields || {})) {
    // Reverse LTAR nesting if column info is available
    if (columns && modelMap && columnModelMap) {
      const column = columns.find((c) => c.title === key || c.id === key);
      if (
        column &&
        (column.uidt === UITypes.LinkToAnotherRecord ||
          (column.uidt === UITypes.Links && linksAsLtar))
      ) {
        const related = resolveRelatedModel(
          column.id!,
          columnModelMap,
          modelMap
        );
        if (related) {
          if (Array.isArray(value)) {
            result[key] = value.map((nested: DataRecordV3) =>
              recordV3ToV2(nested, {
                primaryKeys: related.primaryKeys,
                useColumnId,
                columns: related.columns,
                linksAsLtar,
                modelMap,
                columnModelMap,
              })
            );
          } else if (value && typeof value === 'object' && 'fields' in value) {
            result[key] = recordV3ToV2(value as DataRecordV3, {
              primaryKeys: related.primaryKeys,
              useColumnId,
              columns: related.columns,
              linksAsLtar,
              modelMap,
              columnModelMap,
            });
          }
        }

        // Skip LTAR fields with missing related meta
        continue;
      }
    }

    result[key] = value;
  }

  return result;
}

/**
 * Convert multiple V3 records to V2 format.
 */
export function recordsV3ToV2(
  records: DataRecordV3[],
  options?: RecordV3ToV2Options
): Record<string, any>[] {
  return records.map((record) => recordV3ToV2(record, options));
}
