import { ColumnType, FilterType } from '~/lib/Api';
import {
  FilterClauseSubType,
  FilterGroupSubType,
} from '~/lib/parser/queryFilter/query-filter-cst-parser';
import { QueryFilterParser } from '~/lib/parser/queryFilter/query-filter-parser';
import UITypes from './UITypes';
import { InvalidFilterError } from './error/invalid-filter.error';
import {
  COMPARISON_SUB_OPS,
  FilterParseError,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from './filterHelpers';
import { arrFlatMap } from './arrayHelpers';
import {
  parseLexingError,
  parseParsingError,
} from './parser/queryFilter/error-message-parser';
import { NcContext } from './ncTypes';
export {
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
  GROUPBY_COMPARISON_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from '~/lib/parser/queryFilter/query-filter-lexer';

export interface FilterTypeWithMeta extends FilterType {
  meta?: {
    timezone?: string;
  };
}

export function extractFilterFromXwhere(
  context: Pick<NcContext, 'api_version'> & Pick<NcContext, 'timezone'>,
  {
    str,
    aliasColObjMap,
    throwErrorIfInvalid = false,
    errors = [],
  }: {
    str: string | string[];
    aliasColObjMap: { [columnAlias: string]: ColumnType };
    throwErrorIfInvalid?: boolean;
    errors?: FilterParseError[];
  }
): { filters?: FilterType[]; errors?: FilterParseError[] } {
  if (!str) {
    return { filters: [] };
  }
  for (const columnName of Object.keys(aliasColObjMap)) {
    const column = aliasColObjMap[columnName];
    aliasColObjMap[column.id] = column;
  }
  return innerExtractFilterFromXwhere(context, {
    str,
    aliasColObjMap,
    throwErrorIfInvalid,
    errors,
  });
}

function innerExtractFilterFromXwhere(
  context: Pick<NcContext, 'api_version'> & Pick<NcContext, 'timezone'>,
  {
    str,
    aliasColObjMap,
    throwErrorIfInvalid = false,
    errors = [],
  }: {
    str: string | string[];
    aliasColObjMap: { [columnAlias: string]: ColumnType };
    throwErrorIfInvalid?: boolean;
    errors?: FilterParseError[];
  }
): { filters?: FilterType[]; errors?: FilterParseError[] } {
  if (!str) {
    return { filters: [] };
  } // if array treat it as `and` group
  else if (Array.isArray(str)) {
    // calling recursively for nested query
    const nestedFilters = [].concat(
      ...str.map((s) =>
        extractFilterFromXwhere(context, {
          str: s,
          aliasColObjMap,
          throwErrorIfInvalid,
        })
      )
    );

    // extract and flatten filters
    const filters = nestedFilters.reduce((acc, { filters }) => {
      if (!filters) return acc;
      return [...acc, ...filters];
    }, []);

    // extract and flatten errors
    const collectedErrors = nestedFilters.reduce((acc, { errors }) => {
      if (!errors) return acc;
      return [...acc, ...errors];
    }, []);

    // If errors exist, return them
    if (collectedErrors.length > 0) {
      return { errors: collectedErrors };
    }

    // If there's only one filter, return it directly
    if (filters.length === 1) {
      return { filters: nestedFilters };
    }

    // Otherwise, wrap it in an AND group
    return {
      filters: [
        {
          is_group: true,
          logical_op: 'and',
          children: filters,
        },
      ],
    };
  } else if (typeof str !== 'string') {
    const message =
      'Invalid filter format. Expected string or array of strings';
    if (throwErrorIfInvalid) {
      throw new InvalidFilterError({ message });
    } else {
      errors.push({ message });
      return { errors };
    }
  }
  const parseResult = QueryFilterParser.parse(str);
  if (parseResult.lexErrors.length > 0 || parseResult.parseErrors.length > 0) {
    if (throwErrorIfInvalid)
      throw new InvalidFilterError({
        lexingError: parseResult.lexErrors,
        parsingError: parseResult.parseErrors,
      });
    else {
      if (parseResult.lexErrors.length > 0) {
        errors.push({
          message: parseResult.lexErrors
            .map((k) => parseLexingError(k))
            .join(', '),
        });
      } else if (parseResult.parseErrors.length > 0) {
        errors.push({
          message: parseResult.parseErrors
            .map((k) => parseParsingError(k))
            .join(', '),
        });
      }
      return { errors };
    }
  }

  const filterSubType = parseResult.parsedCst;

  const { filter, errors: parseErrors } = mapFilterGroupSubType(context, {
    filter: filterSubType,
    aliasColObjMap,
    throwErrorIfInvalid,
    errors,
  });
  if (parseErrors?.length > 0) {
    return { errors: parseErrors };
  }
  return { filters: [filter] };
}

function mapFilterGroupSubType(
  context: Pick<NcContext, 'api_version'> & Pick<NcContext, 'timezone'>,
  {
    filter,
    aliasColObjMap,
    throwErrorIfInvalid = false,
    errors = [],
  }: {
    filter: FilterGroupSubType;
    aliasColObjMap: { [columnAlias: string]: ColumnType };
    throwErrorIfInvalid?: boolean;
    errors?: FilterParseError[];
  }
): { filter?: FilterType; errors?: FilterParseError[] } {
  const children = filter.children
    .map((k) =>
      k.is_group
        ? mapFilterGroupSubType(context, {
            filter: k,
            aliasColObjMap,
            throwErrorIfInvalid,
            errors,
          })
        : mapFilterClauseSubType(context, {
            filter: k as FilterClauseSubType,
            aliasColObjMap,
            throwErrorIfInvalid,
            errors,
          })
    )
    .filter((k) => k);

  if (children.length === 1) {
    return children[0];
  } else {
    return {
      filter: {
        is_group: filter.is_group,
        logical_op: filter.logical_op,
        children: children.map((k) => k.filter),
      } as FilterType,
      errors: arrFlatMap(children.map((k) => k.errors || [])).filter((k) => k),
    };
  }
}

function mapFilterClauseSubType(
  context: Pick<NcContext, 'api_version'> & Pick<NcContext, 'timezone'>,
  {
    filter,
    aliasColObjMap,
    throwErrorIfInvalid = false,
    errors = [],
  }: {
    filter: FilterClauseSubType;
    aliasColObjMap: { [columnAlias: string]: ColumnType };
    throwErrorIfInvalid?: boolean;
    errors?: FilterParseError[];
  }
): { filter?: FilterType; errors?: FilterParseError[] } {
  const aliasCol = aliasColObjMap[filter.field];
  if (!aliasCol) {
    if (throwErrorIfInvalid) {
      throw new InvalidFilterError({
        message: `Invalid filter field '${filter.field}' not found`,
      });
    } else {
      errors.push({
        message: `Invalid filter field '${filter.field}' not found`,
      });
      return { errors };
    }
  }
  const result: FilterType = {
    fk_column_id: aliasCol.id,
    is_group: false,
    logical_op: filter.logical_op as any,
    comparison_op: filter.comparison_op as any,
    comparison_sub_op: undefined,
    value: filter.value,
  };
  return handleDataTypes(context, {
    filterType: result,
    column: aliasCol,
    throwErrorIfInvalid,
    errors,
  });
}

function handleDataTypes(
  context: Pick<NcContext, 'api_version'> & Pick<NcContext, 'timezone'>,
  {
    filterType,
    column,
    throwErrorIfInvalid = false,
    errors = [],
  }: {
    filterType: FilterTypeWithMeta;
    column: ColumnType;
    throwErrorIfInvalid?: boolean;
    errors?: FilterParseError[];
  }
): { filter?: FilterType; errors?: FilterParseError[] } {
  if (filterType.value === null) {
    return { filter: filterType };
  }
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(column.uidt as UITypes) &&
    filterType.value
  ) {
    const [subOp, ...value] = Array.isArray(filterType.value)
      ? filterType.value
      : (filterType.value as string).split(',').map((k) => k.trim());

    filterType.comparison_sub_op = subOp as any;
    filterType.value = value.join('');
    if (filterType.comparison_sub_op) {
      if (!COMPARISON_SUB_OPS.includes(filterType.comparison_sub_op)) {
        if (throwErrorIfInvalid)
          throw new InvalidFilterError({
            message: `Invalid filter '${filterType.comparison_sub_op}' is not supported`,
          });
        else {
          errors.push({
            message: `Invalid filter '${filterType.comparison_sub_op}' is not supported`,
          });
          return { errors };
        }
      }
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
      if (throwErrorIfInvalid)
        throw new InvalidFilterError({
          message: `Invalid filter '${filterType.comparison_sub_op}' is not supported for '${filterType.comparison_op}'`,
        });
      else {
        errors.push({
          message: `Invalid filter '${filterType.comparison_sub_op}' is not supported for '${filterType.comparison_op}'`,
        });
        return { errors };
      }
    }
    if (filterType.value === '') {
      filterType.value = undefined;
    }

    filterType.meta = filterType.meta ?? {};
    // use || to also include falsy values
    filterType.meta.timezone = context.timezone || 'Etc/UTC';
  }

  return { filter: filterType };
}
