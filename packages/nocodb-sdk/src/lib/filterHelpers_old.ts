import { ColumnType, FilterType } from '~/lib/Api';
import { BadRequest, NcSDKError } from '~/lib/errorUtils';
import {
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
  FilterParseError,
  GROUPBY_COMPARISON_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS,
  UITypes,
} from '~/lib/index';
export {
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
  GROUPBY_COMPARISON_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from '~/lib/parser/queryFilter/query-filter-lexer';

export function extractFilterFromXwhere(
  str: string | string[],
  aliasColObjMap: { [columnAlias: string]: ColumnType },
  throwErrorIfInvalid = false,
  errors: FilterParseError[] = []
): { filters?: FilterType[]; errors?: FilterParseError[] } {
  if (!str) {
    return { filters: [] };
  }

  // if array treat it as `and` group
  if (Array.isArray(str)) {
    const nestedFilters = str.map((s) =>
      extractFilterFromXwhere(s, aliasColObjMap, throwErrorIfInvalid, errors)
    );

    const filters = nestedFilters.reduce((acc, { filters }) => {
      if (!filters) return acc;
      return [...acc, ...filters];
    }, []);

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
      return { filters };
    }

    // If there's only one filter, return it directly; otherwise, wrap in an AND group
    return {
      filters: [
        {
          is_group: true,
          logical_op: 'and',
          children: filters,
        },
      ],
    };
  }
  // Validate input type
  if (typeof str !== 'string') {
    const error = {
      message: 'Invalid filter format. Expected string or array of strings.',
    };
    if (throwErrorIfInvalid) throw new Error(error.message);
    errors.push(error);
    return { errors };
  }

  let openIndex = str.indexOf('((');
  if (openIndex === -1) openIndex = str.indexOf('(~');

  // If it's a simple query, extract conditions directly
  if (openIndex === -1) {
    if (str !== '~not') {
      const nestedArrayConditions = str.split(
        /(?=~(?:or(?:not)?|and(?:not)?|not)\()/
      );
      return extractCondition(
        nestedArrayConditions,
        aliasColObjMap,
        throwErrorIfInvalid,
        errors
      );
    }
    return { filters: [] };
  }

  let closingIndex = str.indexOf('))');
  let nextOpenIndex = openIndex;

  // Iterate until the correct closing bracket is found
  while (
    (nextOpenIndex = str
      .substring(0, closingIndex)
      .indexOf('((', nextOpenIndex + 1)) !== -1
  ) {
    closingIndex = str.indexOf('))', closingIndex + 1);
  }

  // If no closing bracket is found, return an error
  if (closingIndex === -1) {
    const error = {
      message: `${str
        .substring(0, openIndex + 1)
        .slice(-10)} : Closing bracket not found`,
    };
    if (throwErrorIfInvalid) throw new Error(error.message);
    errors.push(error);
    return { errors };
  }

  // Extract operator and left-hand side of nested query
  const operandStartIndex = str.lastIndexOf('~', openIndex);
  const operator =
    operandStartIndex !== -1
      ? str.substring(operandStartIndex + 1, openIndex)
      : '';
  const lhsOfNestedQuery = str.substring(0, openIndex);

  // Recursively process left-hand side, nested query, and right-hand side
  const lhsResult = extractFilterFromXwhere(
    lhsOfNestedQuery,
    aliasColObjMap,
    throwErrorIfInvalid,
    errors
  );
  const nestedQueryResult = extractFilterFromXwhere(
    str.substring(openIndex + 1, closingIndex + 1),
    aliasColObjMap,
    throwErrorIfInvalid,
    errors
  );
  const rhsResult = extractFilterFromXwhere(
    str.substring(closingIndex + 2),
    aliasColObjMap,
    throwErrorIfInvalid,
    errors
  );

  // If any errors occurred during recursion, return them
  if (lhsResult.errors || nestedQueryResult.errors || rhsResult.errors) {
    return {
      errors: [
        ...(lhsResult.errors || []),
        ...(nestedQueryResult.errors || []),
        ...(rhsResult.errors || []),
      ],
    };
  }

  // Return the combined filters
  return {
    filters: [
      ...(lhsResult.filters || []),
      {
        is_group: true,
        logical_op: operator as FilterType['logical_op'],
        children: nestedQueryResult.filters || [],
      },
      ...(rhsResult.filters || []),
    ],
  };
}

/**
 * Validates a filter comparison operation and its sub-operation.
 *
 * @param {UITypes} uidt - The UI type to validate against.
 * @param {any} op - The main comparison operator.
 * @param {any} [sub_op] - The optional sub-operation.
 * @param {FilterParseError[]} [errors=[]] - An optional array to collect errors.
 * @returns {FilterParseError[]} - An array of validation errors, empty if no errors.
 *
 * This function checks if the given `op` is a valid comparison operator and, if a `sub_op` is provided,
 * ensures it is compatible with the given `uidt`. If any validation fails, errors are added to the array
 * and returned instead of throwing an exception.
 */
export function validateFilterComparison(
  uidt: UITypes,
  op: any,
  sub_op?: any,
  errors: FilterParseError[] = [],
  validateFilterComparison = false
): FilterParseError[] {
  // Check if the main comparison operator is valid
  if (!COMPARISON_OPS.includes(op) && !GROUPBY_COMPARISON_OPS.includes(op)) {
    if (validateFilterComparison) {
      throw new BadRequest(`${op} is not supported.`);
    }
    errors.push({ message: `${op} is not supported.` });
  }

  if (sub_op) {
    // Ensure that sub-operators are only used with specific UI types
    if (
      ![
        UITypes.Date,
        UITypes.DateTime,
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
      ].includes(uidt)
    ) {
      if (validateFilterComparison) {
        throw new BadRequest(
          `'${sub_op}' is not supported for UI Type'${uidt}'.`
        );
      }
      errors.push({
        message: `'${sub_op}' is not supported for UI Type '${uidt}'.`,
      });
    }

    // Validate if the sub-operator exists in the allowed set
    if (!COMPARISON_SUB_OPS.includes(sub_op)) {
      if (validateFilterComparison) {
        throw new BadRequest(`'${sub_op}' is not supported.`);
      }
      errors.push({ message: `'${sub_op}' is not supported.` });
    }

    // Ensure `isWithin` has correct sub-operators, and other operators don't use `isWithin` sub-operators
    if (
      (op === 'isWithin' && !IS_WITHIN_COMPARISON_SUB_OPS.includes(sub_op)) ||
      (op !== 'isWithin' && IS_WITHIN_COMPARISON_SUB_OPS.includes(sub_op))
    ) {
      if (validateFilterComparison) {
        throw new BadRequest(`'${sub_op}' is not supported for '${op}'`);
      }
      errors.push({ message: `'${sub_op}' is not supported for '${op}'.` });
    }
  }

  // Return collected errors, if any
  return errors.length > 0 ? errors : [];
}

export function extractCondition(
  nestedArrayConditions: string[],
  aliasColObjMap: { [columnAlias: string]: ColumnType },
  throwErrorIfInvalid: boolean,
  errors: FilterParseError[]
): { filters?: FilterType[]; errors?: FilterParseError[] } {
  if (!nestedArrayConditions || nestedArrayConditions.length === 0) {
    return { filters: [] };
  }

  const parsedFilters = nestedArrayConditions
    .map<FilterType | null>((str) => {
      let logicOp: string | FilterType['logical_op'];
      let alias: string;
      let op: string | FilterType['comparison_op'];
      let value: string | string[];

      [logicOp, alias, op, value] =
        str.match(/(?:~(and|or|not))?\((.*?),(\w+),(.*)\)/)?.slice(1) || [];

      if (!alias && !op && !value) {
        // Attempt to match blank filter format
        [logicOp, alias, op, value] =
          str.match(/(?:~(and|or|not))?\((.*?),(\w+)\)/)?.slice(1) || [];
      }

      // Normalize filter operations
      switch (op) {
        case 'is':
          if (value === 'blank') {
            op = 'blank';
            value = undefined;
          } else if (value === 'notblank') {
            op = 'notblank';
            value = undefined;
          }
          break;
        case 'isblank':
        case 'is_blank':
          op = 'blank';
          break;
        case 'isnotblank':
        case 'is_not_blank':
        case 'is_notblank':
          op = 'notblank';
          break;
      }

      let sub_op = null;

      if (aliasColObjMap[alias]) {
        const columnType = aliasColObjMap[alias].uidt;

        // Handle date and datetime values
        if (
          [
            UITypes.Date,
            UITypes.DateTime,
            UITypes.LastModifiedTime,
            UITypes.CreatedTime,
          ].includes(columnType as UITypes)
        ) {
          value = (value as string)?.split(',');
          sub_op = (value as string[])?.shift();
          value = (value as string[])?.[0];
          if (sub_op === 'null') {
            sub_op = undefined;
            value = null;
          }
        } else if (op === 'in') {
          value = (value as string).split(',');
        }

        validateFilterComparison(
          columnType as UITypes,
          op,
          sub_op,
          errors,
          throwErrorIfInvalid
        );
      } else {
        const error = {
          message: alias
            ? `Column alias '${alias}' not found.`
            : 'Invalid filter format.',
        };
        if (throwErrorIfInvalid) throw new NcSDKError(error.message);
        errors.push(error);
        return null;
      }

      let columnId = aliasColObjMap[alias]?.id;

      // If alias is not found, check if it matches a column ID directly
      if (
        !columnId &&
        Object.values(aliasColObjMap).some((col) => col?.id === alias)
      ) {
        columnId = alias;
      }

      return {
        comparison_op: op as FilterType['comparison_op'],
        ...(sub_op && {
          comparison_sub_op: sub_op as FilterType['comparison_sub_op'],
        }),
        fk_column_id: columnId,
        logical_op: logicOp as FilterType['logical_op'],
        value,
      };
    })
    .filter(Boolean);

  if (errors.length > 0) {
    return { errors };
  }

  return { filters: parsedFilters };
}
