import { ColumnType, FilterType } from '~/lib/Api';
import { UITypes } from '~/lib/index';
import { NcSDKError } from '~/lib/errorUtils';
import { QueryFilterParser } from './parser/queryFilter/query-filter-parser';
import {
  FilterClauseSubType,
  FilterGroupSubType,
} from './parser/queryFilter/query-filter-cst-parser';

export function extractFilterFromXwhere(
  str: string | string[],
  aliasColObjMap: { [columnAlias: string]: ColumnType },
  throwErrorIfInvalid = false
): FilterType[] {
  for(const columnName of Object.keys(aliasColObjMap)) {
    const column = aliasColObjMap[columnName]
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
  return {
    is_group: filter.is_group,
    logical_op: filter.logical_op,
    children: filter.children
      .map((k) =>
        k.is_group
          ? mapFilterGroupSubType(k, aliasColObjMap, throwErrorIfInvalid)
          : mapFilterClauseSubType(
              k as FilterClauseSubType,
              aliasColObjMap,
              throwErrorIfInvalid
            )
      )
      .filter((k) => k),
  } as FilterType;
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
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedTime,
    ].includes(aliasCol.uidt as any)
  ) {
    result.value =
      !!result.value && Array.isArray(result.value)
        ? result.value
        : result.value?.split(',');
  }
  return result;
}