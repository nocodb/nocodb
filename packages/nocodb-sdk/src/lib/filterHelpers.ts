import { ColumnType, FilterType } from '~/lib/Api';

export {
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
  GROUPBY_COMPARISON_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from '~/lib/parser/queryFilter/query-filter-lexer';
import { extractFilterFromXwhere as parserExtract } from './filterHelpers_withparser';
import { extractFilterFromXwhere as oldExtract } from './filterHelpers_old';
import { NcContext } from './ncTypes';
import { NcApiVersion } from './enums';

export interface FilterParseError {
  message: string;
}

/**
 * Converts a flat array of filter objects into a nested tree structure
 * @param {FilterType[]} items - Array of filter objects
 * @returns {FilterType[]} - Nested tree structure
 */
export function buildFilterTree(items: FilterType[]) {
  const itemMap = new Map();
  const rootItems: FilterType[] = [];

  // Map items with IDs and handle items without IDs
  items.forEach((item) => {
    if (item.id) {
      itemMap.set(item.id, { ...item, children: [] });
    } else {
      // Items without IDs go straight to root level
      rootItems.push({ ...item, children: [] });
    }
  });

  // Build parent-child relationships for items with IDs
  items.forEach((item) => {
    // Skip items without IDs as they're already in rootItems
    if (!item.id) return;

    const mappedItem = itemMap.get(item.id);

    if (item.fk_parent_id === null) {
      rootItems.push(mappedItem);
    } else {
      const parent = itemMap.get(item.fk_parent_id);
      if (parent) {
        parent.children.push(mappedItem);
      } else {
        // If parent is not found, treat as root item
        rootItems.push(mappedItem);
      }
    }
  });

  return rootItems;
}

export function extractFilterFromXwhere(
  context: Pick<NcContext, 'api_version'>,
  str: string | string[],
  aliasColObjMap: { [columnAlias: string]: ColumnType },
  throwErrorIfInvalid = false,
  errors: FilterParseError[] = []
): { filters?: FilterType[]; errors?: FilterParseError[] } {
  if (context.api_version === NcApiVersion.V3) {
    return parserExtract(str, aliasColObjMap, throwErrorIfInvalid, errors);
  } else if (typeof str === 'string' && str.startsWith('@')) {
    return parserExtract(
      str.substring(1),
      aliasColObjMap,
      throwErrorIfInvalid,
      errors
    );
  } else {
    return oldExtract(str, aliasColObjMap, throwErrorIfInvalid, errors);
  }
}
