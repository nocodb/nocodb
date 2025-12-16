import { NocoSDK } from '@noco-integrations/core';

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
