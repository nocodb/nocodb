import { FormulaDataTypes } from '~/lib/formula/enums';

/**
 * Functions offered after a `.`, i.e. read as `value.FN(...)`, by the type of
 * the value in front of the dot. `method-scope.spec.ts` checks every entry
 * validates in that position.
 */
const VALUE_METHODS: Partial<Record<FormulaDataTypes, string[]>> = {
  [FormulaDataTypes.NUMERIC]: [
    'ROUND',
    'ROUNDUP',
    'ROUNDDOWN',
    'ABS',
    'CEILING',
    'FLOOR',
    'INT',
    'MOD',
    'POWER',
    'SQRT',
    'EXP',
    'LOG',
    'EVEN',
    'ODD',
    'ISBLANK',
    'ISNOTBLANK',
  ],
  [FormulaDataTypes.STRING]: [
    'UPPER',
    'LOWER',
    'TRIM',
    'LEN',
    'LEFT',
    'RIGHT',
    'MID',
    'SUBSTR',
    'REPLACE',
    'SEARCH',
    'REPEAT',
    'REGEX_MATCH',
    'REGEX_EXTRACT',
    'REGEX_REPLACE',
    'URLENCODE',
    'VALUE',
    'CONCAT',
    'MD5',
    'SHA256',
    'SHA512',
    'ISBLANK',
    'ISNOTBLANK',
  ],
  [FormulaDataTypes.DATE]: [
    'DATEADD',
    'DATETIME_DIFF',
    'DATETIME_FORMAT',
    'DATESTR',
    'DAY',
    'MONTH',
    'YEAR',
    'HOUR',
    'WEEKDAY',
    'WEEKNUM',
    'ISBLANK',
    'ISNOTBLANK',
  ],
  [FormulaDataTypes.BOOLEAN]: ['ISBLANK', 'ISNOTBLANK'],
};

// the array helpers work on any list
const ARRAY_METHODS = [
  'ARRAYUNIQUE',
  'ARRAYSORT',
  'ARRAYCOMPACT',
  'ARRAYSLICE',
];

const LIST_METHODS: Partial<Record<FormulaDataTypes, string[]>> = {
  [FormulaDataTypes.NUMERIC]: [
    'SUM',
    'AVG',
    'MIN',
    'MAX',
    'COUNT',
    'COUNTA',
    'COUNTALL',
    'CONCAT',
    ...ARRAY_METHODS,
  ],
};

const DEFAULT_LIST_METHODS = ['COUNTA', 'COUNTALL', 'CONCAT', ...ARRAY_METHODS];

/**
 * Function names that make sense as `value.FN()`.
 * Returns null when the value's type is unknown, meaning any function may fit.
 */
export function getMethodFunctions(
  dataType: FormulaDataTypes | string | undefined,
  isList: boolean
): string[] | null {
  if (isList) {
    return LIST_METHODS[dataType as FormulaDataTypes] ?? DEFAULT_LIST_METHODS;
  }
  return VALUE_METHODS[dataType as FormulaDataTypes] ?? null;
}
