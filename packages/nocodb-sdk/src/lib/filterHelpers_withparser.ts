import { ColumnType, FilterType } from '~/lib/Api';
import { BadRequest, NcSDKError } from '~/lib/errorUtils';
import {
  FilterClauseSubType,
  FilterGroupSubType,
} from '~/lib/parser/queryFilter/query-filter-cst-parser';
import { QueryFilterParser } from '~/lib/parser/queryFilter/query-filter-parser';
import UITypes from './UITypes';
import {
  COMPARISON_SUB_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from './filterHelpers';
export {
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
  GROUPBY_COMPARISON_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from '~/lib/parser/queryFilter/query-filter-lexer';

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
    throw new NcSDKError('INVALID_FILTER');
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
    comparison_sub_op: undefined,
    value: filter.value,
  };
  return handleDataTypes(result, aliasCol);
}

function handleDataTypes(
  filterType: FilterType,
  column: ColumnType
): FilterType {
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(column.uidt as UITypes)
  ) {
    if (!filterType.value) {
      throw new BadRequest(
        `'' is not supported for '${filterType.comparison_op}'`
      );
    }
    const [subOp, ...value] = Array.isArray(filterType.value)
      ? filterType.value
      : (filterType.value as string).split(',').map((k) => k.trim());

    filterType.comparison_sub_op = subOp as any;
    filterType.value = value.join('');
    if (!COMPARISON_SUB_OPS.includes(filterType.comparison_sub_op)) {
      throw new BadRequest(
        `'${filterType.comparison_sub_op}' is not supported.`
      );
    }
    if (
      (filterType.comparison_op === 'isWithin' &&
        !IS_WITHIN_COMPARISON_SUB_OPS.includes(
          filterType.comparison_sub_op as any
        )) ||
      (filterType.comparison_op !== 'isWithin' &&
        IS_WITHIN_COMPARISON_SUB_OPS.includes(
          filterType.comparison_sub_op as any
        ))
    ) {
      throw new BadRequest(
        `'${filterType.comparison_sub_op}' is not supported for '${filterType.comparison_op}'`
      );
    }
    if (filterType.value === '') {
      filterType.value = undefined;
    }
  }

  return filterType;
}
