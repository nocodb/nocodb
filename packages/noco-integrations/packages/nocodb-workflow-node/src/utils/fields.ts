import { NocoSDK } from '@noco-integrations/core';
import type { NocoDBContext } from '@noco-integrations/core';

interface DataRecord {
  id?: string | number;
  fields: Record<string, unknown>;
}

export const NON_EDITABLE_FIELDS = [
  NocoSDK.UITypes.Button,
  NocoSDK.UITypes.QrCode,
  NocoSDK.UITypes.Barcode,
  NocoSDK.UITypes.Formula,
  NocoSDK.UITypes.CreatedTime,
  NocoSDK.UITypes.LastModifiedTime,
  NocoSDK.UITypes.CreatedBy,
  NocoSDK.UITypes.LastModifiedBy,
  NocoSDK.UITypes.Lookup,
  NocoSDK.UITypes.Rollup,
];

/**
 * Normalize various relation input formats to array format
 * Supports:
 * - Array: ["id1", "id2"] or [{id: "id1"}, {id: "id2"}]
 * - Comma-separated string: "id1,id2,id3"
 * - Comma-separated with quotes: '"user,123","org,456"'
 * - Single value: "id1" or {id: "id1"}
 */
export function normalizeRelationInput(
  value: any,
): { id: string } | { id: string }[] | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  // Already in correct format (array of objects with id)
  if (Array.isArray(value)) {
    // If it's already array of objects with id, keep as is
    if (value.length > 0 && typeof value[0] === 'object' && 'id' in value[0]) {
      return value as { id: string }[];
    }
    // If it's array of primitives, convert to {id: value} format
    return value.map((item) => ({ id: String(item) }));
  }

  // Single object with id property (v3 format)
  if (typeof value === 'object' && 'id' in value) {
    return value as { id: string };
  }

  // Handle string - parse comma-separated with quote support
  if (typeof value === 'string') {
    const parsed = parseCommaSeparated(value);
    // If single value, return as object; if multiple, return as array
    if (parsed.length === 1) {
      return { id: parsed[0] };
    }
    return parsed.map((id) => ({ id }));
  }

  // Handle single primitive value (number, etc.)
  return { id: String(value) };
}

/**
 * Parse comma-separated string with quote support
 * Examples:
 * - "id1,id2,id3" -> ["id1", "id2", "id3"]
 * - '"user,123","org,456"' -> ["user,123", "org,456"]
 * - 'id1,"user,123",id3' -> ["id1", "user,123", "id3"]
 */
function parseCommaSeparated(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // Comma outside quotes - it's a delimiter
      const trimmed = current.trim();
      if (trimmed) {
        result.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Add last item
  const trimmed = current.trim();
  if (trimmed) {
    result.push(trimmed);
  }

  return result.length > 0 ? result : [input.trim()];
}

/**
 * Parse relation input into individual values
 * Handles comma-separated strings with quote support
 */
export function parseRelationInput(value: any): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  // Already an array
  if (Array.isArray(value)) {
    // Array of objects with id - extract ids
    if (value.length > 0 && typeof value[0] === 'object' && 'id' in value[0]) {
      return value.map((item) => String(item.id));
    }
    // Array of primitives
    return value.map((item) => String(item));
  }

  // Single object with id
  if (typeof value === 'object' && 'id' in value) {
    return [String(value.id)];
  }

  // String - parse comma-separated
  if (typeof value === 'string') {
    return parseCommaSeparated(value);
  }

  // Single primitive
  return [String(value)];
}

/**
 * Resolve relation input values to record IDs by matching against
 * primary key or display field (primary value).
 *
 * Priority:
 * 1. Exact match on primary key (ID)
 * 2. Case-sensitive match on display field
 * 3. Case-insensitive match on display field
 *
 * Only the first match is used for each input value.
 */
export async function resolveRelationInputValues(params: {
  nocodb: NocoDBContext;
  column: NocoSDK.ColumnType;
  inputValues: string[];
  baseId: string;
  workspaceId: string;
}): Promise<{ id: string }[]> {
  const { nocodb, column, inputValues, baseId, workspaceId } = params;

  if (!inputValues.length) return [];

  // Get related table ID from column options
  const colOptions = column.colOptions as
    | NocoSDK.LinkToAnotherRecordType
    | undefined;
  const relatedTableId = colOptions?.fk_related_model_id;

  if (!relatedTableId) return [];

  // Get related table with columns
  const relatedTable = await nocodb.tablesService.getTableWithAccessibleViews(
    nocodb.context,
    { tableId: relatedTableId, user: nocodb.user },
  );

  if (!relatedTable?.columns) return [];

  // Find primary key and display column (primary value)
  const pkColumn = relatedTable.columns.find(
    (col: NocoSDK.ColumnType) => col.pk,
  );
  const pvColumn = relatedTable.columns.find(
    (col: NocoSDK.ColumnType) => col.pv,
  );

  if (!pkColumn) return [];

  // Build where clause string like frontend does: (field,op,value)~or(field2,op,value)
  // This properly handles type-aware filtering
  const whereConditions: string[] = [];

  for (const value of inputValues) {
    const trimmedValue = value.trim();
    if (!trimmedValue) continue;

    // For PK column: only add if value is valid for the column type
    // For numeric PKs (ID, Number, etc.), only match if value looks like a number
    const isNumericPk = NocoSDK.isNumericCol(pkColumn);
    if (!isNumericPk || /^\d+$/.test(trimmedValue)) {
      // Use 'eq' for PK matching (exact match)
      whereConditions.push(`(${pkColumn.title},eq,${trimmedValue})`);
    }

    // For display field: use 'like' for text search (case-insensitive partial match)
    if (pvColumn && pvColumn.id !== pkColumn.id) {
      // Use 'like' with wildcards for display field
      whereConditions.push(`(${pvColumn.title},like,%${trimmedValue}%)`);
    }
  }

  // If no valid conditions, return empty
  if (whereConditions.length === 0) return [];

  // Join conditions with ~or
  const whereClause = whereConditions.join('~or');

  // Fetch matching records
  const context: NocoSDK.NcContext = {
    workspace_id: workspaceId,
    base_id: baseId,
    api_version: NocoSDK.NcApiVersion.V3,
    user: nocodb.user,
  };

  let records: DataRecord[] = [];
  try {
    const result = await nocodb.dataService.dataList(
      context,
      {
        modelId: relatedTableId,
        query: {
          where: whereClause,
          limit: inputValues.length * 10, // Fetch enough for potential matches (like can return multiple)
        },
        ignorePagination: false,
        req: { user: nocodb.user } as NocoSDK.NcRequest,
      },
      false,
    );
    records = result;
  } catch (e) {
    console.error(e);
    // If query fails, return empty - let the API handle validation
    return [];
  }

  // Match each input value with priority: pk > case-sensitive pv > case-insensitive pv
  const resolvedIds: { id: string }[] = [];
  const usedRecordIds = new Set<string>();

  for (const inputValue of inputValues) {
    let matchedRecord: DataRecord | undefined;

    // Priority 1: Exact pk match
    matchedRecord = records.find((r: DataRecord) => {
      const recordId = r.id;
      const pkValue = r.fields?.[pkColumn.title!];
      const idMatch =
        String(recordId) === inputValue || String(pkValue) === inputValue;
      return idMatch && !usedRecordIds.has(String(recordId));
    });

    // Priority 2: Case-sensitive pv match
    if (!matchedRecord && pvColumn) {
      matchedRecord = records.find((r: DataRecord) => {
        const recordId = r.id;
        const pvValue = r.fields?.[pvColumn.title!];
        return (
          String(pvValue) === inputValue && !usedRecordIds.has(String(recordId))
        );
      });
    }

    // Priority 3: Case-insensitive pv match
    if (!matchedRecord && pvColumn) {
      matchedRecord = records.find((r: DataRecord) => {
        const recordId = r.id;
        const pvValue = r.fields?.[pvColumn.title!];
        return (
          String(pvValue).toLowerCase() === inputValue.toLowerCase() &&
          !usedRecordIds.has(String(recordId))
        );
      });
    }

    if (matchedRecord) {
      const recordId = matchedRecord.id;
      resolvedIds.push({ id: String(recordId) });
      usedRecordIds.add(String(recordId));
    }
  }

  return resolvedIds;
}
