import { ColumnType, FilterType } from '~/lib/Api';
import { BadRequest, NcSDKError } from '~/lib/errorUtils';
import {
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
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

  // if array treat it as `and` group
  if (Array.isArray(str)) {
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

  let nestedArrayConditions = [];

  let openIndex = str.indexOf('((');

  if (openIndex === -1) openIndex = str.indexOf('(~');

  let nextOpenIndex = openIndex;

  let closingIndex = str.indexOf('))');

  // if it's a simple query simply return array of conditions
  if (openIndex === -1) {
    if (str && str != '~not')
      nestedArrayConditions = str.split(
        /(?=~(?:or(?:not)?|and(?:not)?|not)\()/
      );
    return extractCondition(
      nestedArrayConditions || [],
      aliasColObjMap,
      throwErrorIfInvalid
    );
  }

  // iterate until finding right closing
  while (
    (nextOpenIndex = str
      .substring(0, closingIndex)
      .indexOf('((', nextOpenIndex + 1)) != -1
  ) {
    closingIndex = str.indexOf('))', closingIndex + 1);
  }

  if (closingIndex === -1)
    throw new Error(
      `${str
        .substring(0, openIndex + 1)
        .slice(-10)} : Closing bracket not found`
    );

  // getting operand starting index
  const operandStartIndex = str.lastIndexOf('~', openIndex);
  const operator =
    operandStartIndex != -1
      ? str.substring(operandStartIndex + 1, openIndex)
      : '';
  const lhsOfNestedQuery = str.substring(0, openIndex);

  nestedArrayConditions.push(
    ...extractFilterFromXwhere(
      lhsOfNestedQuery,
      aliasColObjMap,
      throwErrorIfInvalid
    ),
    // calling recursively for nested query
    {
      is_group: true,
      logical_op: operator,
      children: extractFilterFromXwhere(
        str.substring(openIndex + 1, closingIndex + 1),
        aliasColObjMap
      ),
    },
    // RHS of nested query(recursion)
    ...extractFilterFromXwhere(
      str.substring(closingIndex + 2),
      aliasColObjMap,
      throwErrorIfInvalid
    )
  );
  return nestedArrayConditions;
}

// mark `op` and `sub_op` any for being assignable to parameter of type
export function validateFilterComparison(uidt: UITypes, op: any, sub_op?: any) {
  if (!COMPARISON_OPS.includes(op) && !GROUPBY_COMPARISON_OPS.includes(op)) {
    throw new BadRequest(`${op} is not supported.`);
  }

  if (sub_op) {
    if (
      ![
        UITypes.Date,
        UITypes.DateTime,
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
      ].includes(uidt)
    ) {
      throw new BadRequest(
        `'${sub_op}' is not supported for UI Type'${uidt}'.`
      );
    }
    if (!COMPARISON_SUB_OPS.includes(sub_op)) {
      throw new BadRequest(`'${sub_op}' is not supported.`);
    }
    if (
      (op === 'isWithin' && !IS_WITHIN_COMPARISON_SUB_OPS.includes(sub_op)) ||
      (op !== 'isWithin' && IS_WITHIN_COMPARISON_SUB_OPS.includes(sub_op))
    ) {
      throw new BadRequest(`'${sub_op}' is not supported for '${op}'`);
    }
  }
}

export function extractCondition(
  nestedArrayConditions,
  aliasColObjMap,
  throwErrorIfInvalid
) {
  return nestedArrayConditions?.map((str) => {
    let [logicOp, alias, op, value] =
      str.match(/(?:~(and|or|not))?\((.*?),(\w+),(.*)\)/)?.slice(1) || [];

    if (!alias && !op && !value) {
      // try match with blank filter format
      [logicOp, alias, op, value] =
        str.match(/(?:~(and|or|not))?\((.*?),(\w+)\)/)?.slice(1) || [];
    }

    // handle isblank and isnotblank filter format
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
      if (
        [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ].includes(aliasColObjMap[alias].uidt)
      ) {
        value = value?.split(',');
        // the first element would be sub_op
        sub_op = value?.[0];
        // remove the first element which is sub_op
        value?.shift();
        value = value?.[0];
      } else if (op === 'in') {
        value = value.split(',');
      }

      validateFilterComparison(aliasColObjMap[alias].uidt, op, sub_op);
    } else if (throwErrorIfInvalid) {
      throw new NcSDKError('INVALID_FILTER');
    }

    let columnId = aliasColObjMap[alias]?.id;

    // if not found then check if it's a valid column id
    if (
      !columnId &&
      Object.values(aliasColObjMap).some((col: ColumnType) => col?.id === alias)
    ) {
      columnId = alias;
    }

    return {
      comparison_op: op,
      ...(sub_op && { comparison_sub_op: sub_op }),
      fk_column_id: columnId,
      logical_op: logicOp,
      value,
    };
  });
}
