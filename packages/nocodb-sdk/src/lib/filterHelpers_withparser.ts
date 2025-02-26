import { ColumnType, FilterType } from '~/lib/Api';
import { NcSDKError } from '~/lib/errorUtils';
import {
  FilterClauseSubType,
  FilterGroupSubType,
} from '~/lib/parser/queryFilter/query-filter-cst-parser';
import { QueryFilterParser } from '~/lib/parser/queryFilter/query-filter-parser';
export {
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
  GROUPBY_COMPARISON_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS
} from '~/lib/parser/queryFilter/query-filter-lexer';

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
  str: string | string[],
  aliasColObjMap: { [columnAlias: string]: ColumnType },
  throwErrorIfInvalid = false
): FilterType[] {
  if (!str) {
    return [];
  }
  for (const columnName of Object.keys(aliasColObjMap)) {
    const column = aliasColObjMap[columnName];
    aliasColObjMap[column.id] = column;
  }
  return innerExtractFilterFromXwhere(str, aliasColObjMap, throwErrorIfInvalid);
}

function innerExtractFilterFromXwhere(
  str: string | string[],
  aliasColObjMap: { [columnAlias: string]: ColumnType },
  throwErrorIfInvalid = false
): FilterType[] {
  if (!str) {
    return [];
  } // if array treat it as `and` group
  else if (Array.isArray(str)) {
    // calling recursively for nested query
    const nestedFilters = [].concat(
      ...str.map((s) =>
        extractFilterFromXwhere(s, aliasColObjMap, throwErrorIfInvalid)
      )
    );

    // If there's only one filter, return it directly
    if (nestedFilters.length === 1) {
      return nestedFilters;
    }

    // Otherwise, wrap it in an AND group
    return [
      {
        is_group: true,
        logical_op: 'and',
        children: nestedFilters,
      },
    ];
  } else if (typeof str !== 'string' && throwErrorIfInvalid) {
    throw new Error(
      'Invalid filter format. Expected string or array of strings.'
    );
  }
  const parseResult = QueryFilterParser.parse(str);
  if (
    (parseResult.lexErrors.length > 0 || parseResult.parseErrors.length > 0) &&
    throwErrorIfInvalid
  ) {
    throw parseResult.lexErrors[0] ?? parseResult.parseErrors[0];
  }
  const filterSubType = parseResult.parsedCst;
  return [
    mapFilterGroupSubType(filterSubType, aliasColObjMap, throwErrorIfInvalid),
  ];
}

function mapFilterGroupSubType(
  filter: FilterGroupSubType,
  aliasColObjMap: { [columnAlias: string]: ColumnType },
  throwErrorIfInvalid = false
): FilterType {
  const children = filter.children
    .map((k) =>
      k.is_group
        ? mapFilterGroupSubType(k, aliasColObjMap, throwErrorIfInvalid)
        : mapFilterClauseSubType(
            k as FilterClauseSubType,
            aliasColObjMap,
            throwErrorIfInvalid
          )
    )
    .filter((k) => k);
  if (children.length === 1) {
    return children[0];
  } else {
    return {
      is_group: filter.is_group,
      logical_op: filter.logical_op,
      children: children,
    } as FilterType;
  }
}

function mapFilterClauseSubType(
  filter: FilterClauseSubType,
  aliasColObjMap: { [columnAlias: string]: ColumnType },
  throwErrorIfInvalid = false
): FilterType | undefined {
  const aliasCol = aliasColObjMap[filter.field];
  if (!aliasCol) {
    if (throwErrorIfInvalid) {
      throw new NcSDKError('INVALID_FILTER');
    }
    return undefined;
  }
  const result: FilterType = {
    fk_column_id: aliasCol.id,
    is_group: false,
    logical_op: filter.logical_op as any,
    comparison_op: filter.comparison_op as any,
    comparison_sub_op: filter.comparison_sub_op as any,
    value: filter.value,
  };
  return result;
}