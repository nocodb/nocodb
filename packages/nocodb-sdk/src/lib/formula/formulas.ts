import { validateDateWithUnknownFormat } from '../dateTimeHelper';
import { FormulaDataTypes, FormulaErrorType, JSEPNode } from './enums';
import { FormulaError } from './error';
import { FormulaMeta } from './types';
export const API_DOC_PREFIX = 'https://nocodb.com/docs/product-docs/fields';

export const formulas: Record<string, FormulaMeta> = {
  AVG: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#avg`,
    validation: {
      args: {
        min: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description: 'Average of input parameters',
    syntax: 'AVG(value1, [value2, ...])',
    examples: [
      'AVG(10, 5) => 7.5',
      'AVG({column1}, {column2})',
      'AVG({column1}, {column2}, {column3})',
    ],
    returnType: FormulaDataTypes.NUMERIC,
  },
  ADD: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#add`,
    validation: {
      args: {
        min: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description: 'Sum of input parameters',
    syntax: 'ADD(value1, [value2, ...])',
    examples: [
      'ADD(5, 5) => 10',
      'ADD({column1}, {column2})',
      'ADD({column1}, {column2}, {column3})',
    ],
    returnType: FormulaDataTypes.NUMERIC,
  },
  DATEADD: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/date-functions#dateadd`,
    validation: {
      args: {
        rqd: 3,
        type: FormulaDataTypes.DATE,
      },
      custom: (_argTypes: FormulaDataTypes[], parsedTree: any) => {
        if (parsedTree.arguments[0].type === JSEPNode.LITERAL) {
          if (!validateDateWithUnknownFormat(parsedTree.arguments[0].value)) {
            throw new FormulaError(
              FormulaErrorType.TYPE_MISMATCH,
              { key: 'msg.formula.firstParamDateAddHaveDate' },
              'First parameter of DATEADD should be a date'
            );
          }
        }

        if (parsedTree.arguments[1].type === JSEPNode.LITERAL) {
          if (typeof parsedTree.arguments[1].value !== 'number') {
            throw new FormulaError(
              FormulaErrorType.TYPE_MISMATCH,
              { key: 'msg.formula.secondParamDateAddHaveNumber' },
              'Second parameter of DATEADD should be a number'
            );
          }
        }
        if (parsedTree.arguments[2].type === JSEPNode.LITERAL) {
          if (
            ![
              'day',
              'week',
              'month',
              'year',
              'hour',
              'minute',
              'second',
            ].includes(parsedTree.arguments[2].value)
          ) {
            throw new FormulaError(
              FormulaErrorType.TYPE_MISMATCH,
              { key: 'msg.formula.thirdParamDateAddHaveDate' },
              "Third parameter of DATEADD should be one of 'day', 'week', 'month', 'year', 'hour', 'minute', 'second'"
            );
          }
        }
      },
    },
    description: 'Adds "count" units to Datetime.',
    syntax:
      'DATEADD(date | datetime, count, ["day" | "week" | "month" | "year" | "hour" | "minute" | "second"])',
    examples: [
      'DATEADD({column1}, 2, "day")',
      'DATEADD({column1}, -2, "day")',
      'DATEADD({column1}, 2, "week")',
      'DATEADD({column1}, -2, "week")',
      'DATEADD({column1}, 2, "month")',
      'DATEADD({column1}, -2, "month")',
      'DATEADD({column1}, 2, "year")',
      'DATEADD({column1}, -2, "year")',
    ],
    returnType: FormulaDataTypes.DATE,
  },
  DATESTR: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/date-functions#datestr`,
    validation: {
      args: {
        rqd: 1,
      },
    },
    syntax: 'DATESTR(date | datetime)',
    description: 'Formats input field into a string in "YYYY-MM-DD" format',
    examples: ['DATESTR({column1})'],
    returnType: FormulaDataTypes.STRING,
  },
  DAY: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/date-functions#day`,
    validation: {
      args: {
        rqd: 1,
      },
    },
    syntax: 'DAY(date | datetime)',
    description: 'Extract day from a date field (1-31)',
    examples: ['DAY({column1})'],
    returnType: FormulaDataTypes.STRING,
  },
  MONTH: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/date-functions#month`,
    validation: {
      args: {
        rqd: 1,
      },
    },
    syntax: 'MONTH(date | datetime)',
    description: 'Extract month from a date field (1-12)',
    examples: ['MONTH({column1})'],
    returnType: FormulaDataTypes.STRING,
  },
  YEAR: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/date-functions#year`,
    validation: {
      args: {
        rqd: 1,
      },
    },
    syntax: 'YEAR(date | datetime)',
    description: 'Extract year from a date field',
    examples: ['YEAR({column1})'],
    returnType: FormulaDataTypes.STRING,
  },
  HOUR: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/date-functions#hour`,
    validation: {
      args: {
        rqd: 1,
      },
    },
    syntax: 'DAY(time | datetime)',
    description: 'Extract hour from a time field (0-23)',
    examples: ['HOUR({column1})'],
    returnType: FormulaDataTypes.STRING,
  },
  DATETIME_DIFF: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/date-functions#datetime_diff`,

    validation: {
      args: {
        min: 2,
        max: 3,
        type: FormulaDataTypes.DATE,
      },
      custom: (_argTypes: FormulaDataTypes[], parsedTree: any) => {
        if (parsedTree.arguments[0].type === JSEPNode.LITERAL) {
          if (!validateDateWithUnknownFormat(parsedTree.arguments[0].value)) {
            throw new FormulaError(
              FormulaErrorType.TYPE_MISMATCH,
              { key: 'msg.formula.firstParamDateDiffHaveDate' },
              'First parameter of DATETIME_DIFF should be a date'
            );
          }
        }

        if (parsedTree.arguments[1].type === JSEPNode.LITERAL) {
          if (!validateDateWithUnknownFormat(parsedTree.arguments[1].value)) {
            throw new FormulaError(
              FormulaErrorType.TYPE_MISMATCH,
              { key: 'msg.formula.secondParamDateDiffHaveDate' },
              'Second parameter of DATETIME_DIFF should be a date'
            );
          }
        }
        if (
          parsedTree.arguments[2] &&
          parsedTree.arguments[2].type === JSEPNode.LITERAL
        ) {
          if (
            ![
              'milliseconds',
              'ms',
              'seconds',
              's',
              'minutes',
              'm',
              'hours',
              'h',
              'days',
              'd',
              'weeks',
              'w',
              'months',
              'M',
              'quarters',
              'Q',
              'years',
              'y',
            ].includes(parsedTree.arguments[2].value)
          ) {
            throw new FormulaError(
              FormulaErrorType.TYPE_MISMATCH,
              { key: 'msg.formula.thirdParamDateDiffHaveDate' },
              "Third parameter of DATETIME_DIFF should be one of 'milliseconds', 'ms', 'seconds', 's', 'minutes', 'm', 'hours', 'h', 'days', 'd', 'weeks', 'w', 'months', 'M', 'quarters', 'Q', 'years', 'y'"
            );
          }
        }
      },
    },
    description:
      'Calculate the difference of two given date / datetime fields in specified units.',
    syntax:
      'DATETIME_DIFF(date | datetime, date | datetime, ["milliseconds" | "ms" | "seconds" | "s" | "minutes" | "m" | "hours" | "h" | "days" | "d" | "weeks" | "w" | "months" | "M" | "quarters" | "Q" | "years" | "y"])',
    examples: [
      'DATEDIFF({column1}, {column2})',
      'DATEDIFF({column1}, {column2}, "seconds")',
      'DATEDIFF({column1}, {column2}, "s")',
      'DATEDIFF({column1}, {column2}, "years")',
      'DATEDIFF({column1}, {column2}, "y")',
      'DATEDIFF({column1}, {column2}, "minutes")',
      'DATEDIFF({column1}, {column2}, "m")',
      'DATEDIFF({column1}, {column2}, "days")',
      'DATEDIFF({column1}, {column2}, "d")',
    ],
    returnType: FormulaDataTypes.NUMERIC,
  },
  AND: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/conditional-expressions#and`,

    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Result is TRUE if all conditions are met',
    syntax: 'AND(expr1, [expr2, ...])',
    examples: ['AND(5 > 2, 5 < 10) => 1', 'AND({column1} > 2, {column2} < 10)'],
    returnType: FormulaDataTypes.COND_EXP,
  },
  OR: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/conditional-expressions#or`,

    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Result is TRUE if at least one condition is met',
    syntax: 'OR(expr1, [expr2, ...])',
    examples: ['OR(5 > 2, 5 < 10) => 1', 'OR({column1} > 2, {column2} < 10)'],
    returnType: FormulaDataTypes.COND_EXP,
  },
  CONCAT: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#concat`,

    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Concatenate input parameters into a single string',
    syntax: 'CONCAT(str1, [str2, ...])',
    examples: [
      'CONCAT("AA", "BB", "CC") => "AABBCC"',
      'CONCAT({column1}, {column2}, {column3})',
    ],
    returnType: FormulaDataTypes.STRING,
  },
  TRIM: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#trim`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.STRING,
      },
    },
    description: 'Remove trailing and leading whitespaces from input parameter',
    syntax: 'TRIM(str)',
    examples: [
      'TRIM("         HELLO WORLD  ") => "HELLO WORLD"',
      'TRIM({column1})',
    ],
    returnType: FormulaDataTypes.STRING,
  },
  UPPER: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#upper`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.STRING,
      },
    },
    description: 'Converts the input parameter to an upper-case string.',
    syntax: 'UPPER(str)',
    examples: ['UPPER("nocodb") => "NOCODB"', 'UPPER({column1})'],
    returnType: FormulaDataTypes.STRING,
  },
  LOWER: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#lower`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.STRING,
      },
    },
    description: 'Converts the input parameter to an lower-case string.',
    syntax: 'LOWER(str)',
    examples: ['LOWER("NOCODB") => "nocodb"', 'LOWER({column1})'],
    returnType: FormulaDataTypes.STRING,
  },
  LEN: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#len`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.STRING,
      },
    },
    description: 'Calculate the character length of the input parameter.',
    syntax: 'LEN(value)',
    examples: ['LEN("NocoDB") => 6', 'LEN({column1})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  MIN: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#min`,

    validation: {
      args: {
        min: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description: 'Find the minimum value among the input parameters.',
    syntax: 'MIN(value1, [value2, ...])',
    examples: ['MIN(1000, 2000) => 1000', 'MIN({column1}, {column2})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  MAX: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#max`,

    validation: {
      args: {
        min: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description: 'Find the maximum value among the input parameters.',
    syntax: 'MAX(value1, [value2, ...])',
    examples: ['MAX(1000, 2000) => 2000', 'MAX({column1}, {column2})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  CEILING: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#ceiling`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description:
      'Rounds the input parameter to the next largest integer value.',
    syntax: 'CEILING(value)',
    examples: ['CEILING(1.01) => 2', 'CEILING({column1})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  FLOOR: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#floor`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description: 'Round down the input parameter to the nearest integer.',
    syntax: 'FLOOR(value)',
    examples: ['FLOOR(3.1415) => 3', 'FLOOR({column1})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  ROUND: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#round`,

    validation: {
      args: {
        min: 1,
        max: 2,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description:
      'Rounds the number to a specified decimal places or the nearest integer if precision is not specified',
    syntax: 'ROUND(value, precision), ROUND(value)',
    examples: [
      'ROUND(3.1415) => 3',
      'ROUND(3.1415, 2) => 3.14',
      'ROUND({column1}, 3)',
    ],
    returnType: FormulaDataTypes.NUMERIC,
  },
  MOD: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#mod`,

    validation: {
      args: {
        rqd: 2,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description:
      'Calculate the remainder resulting from integer division of input parameters.',
    syntax: 'MOD(value1, value2)',
    examples: ['MOD(1024, 1000) => 24', 'MOD({column}, 2)'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  REPEAT: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#repeat`,

    validation: {
      args: {
        rqd: 2,
      },
      custom(argTypes: FormulaDataTypes[], parsedTree) {
        if (argTypes[1] !== FormulaDataTypes.NUMERIC) {
          throw new FormulaError(
            FormulaErrorType.INVALID_ARG,
            {
              key: 'msg.formula.typeIsExpected',
              type: 'Numeric',
              calleeName: parsedTree.callee?.name?.toUpperCase(),
              position: 2,
            },
            'The REPEAT function requires a numeric as the parameter at position 2'
          );
        }
      },
    },
    description:
      'Concatenate the specified number of copies of the input parameter string.',
    syntax: 'REPEAT(str, count)',
    examples: ['REPEAT("A", 5) => "AAAAA"', 'REPEAT({column}, 5)'],
    returnType: FormulaDataTypes.STRING,
  },
  LOG: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#log`,

    validation: {
      args: {
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description:
      'Compute the logarithm of the input parameter to the specified base (default = e).',
    syntax: 'LOG([base], value)',
    examples: ['LOG(2, 1024) => 10', 'LOG(2, {column1})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  EXP: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#exp`,

    validation: {
      args: {
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description:
      'Compute the exponential value of the input parameter (e raised to the power specified)',
    syntax: 'EXP(power)',
    examples: ['EXP(1) => 2.718281828459045', 'EXP({column1})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  POWER: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#power`,

    validation: {
      args: {
        rqd: 2,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description: 'Compute base raised to the exponent power.',
    syntax: 'POWER(base, exponent)',
    examples: ['POWER(2, 10) => 1024', 'POWER({column1}, 10)'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  SQRT: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#sqrt`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description: 'Calculate the square root of the input parameter.',
    syntax: 'SQRT(value)',
    examples: ['SQRT(100) => 10', 'SQRT({column1})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  ABS: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#abs`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description: 'Obtain the absolute value of the input parameter.',
    syntax: 'ABS(value)',
    examples: ['ABS({column1})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  NOW: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/date-functions#now`,

    validation: {
      args: {
        rqd: 0,
        type: FormulaDataTypes.DATE,
      },
    },
    description: 'Retrieve the current time and day.',
    syntax: 'NOW()',
    examples: ['NOW() => 2022-05-19 17:20:43'],
    returnType: FormulaDataTypes.DATE,
  },
  REPLACE: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#replace`,

    validation: {
      args: {
        rqd: 3,
        type: FormulaDataTypes.STRING,
      },
    },
    description:
      'Replace all occurrences of "searchStr" with "replaceStr" in the given string.',
    syntax: 'REPLACE(str, searchStr, replaceStr)',
    examples: [
      'REPLACE("AABBCC", "AA", "BB") => "BBBBCC"',
      'REPLACE({column1}, {column2}, {column3})',
    ],
    returnType: FormulaDataTypes.STRING,
  },
  SEARCH: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#search`,

    validation: {
      args: {
        rqd: 2,
        type: FormulaDataTypes.STRING,
      },
    },
    description:
      'Retrieve the index of the specified "searchStr" if found; otherwise, returns 0.',
    syntax: 'SEARCH(str, searchStr)',
    examples: [
      'SEARCH("HELLO WORLD", "WORLD") => 7',
      'SEARCH({column1}, "abc")',
    ],
    returnType: FormulaDataTypes.NUMERIC,
  },
  INT: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#int`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description: 'Obtain the integer value of the input parameter',
    syntax: 'INT(value)',
    examples: ['INT(3.1415) => 3', 'INT({column1})'],
    returnType: FormulaDataTypes.NUMERIC,
  },
  RIGHT: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#right`,

    validation: {
      args: {
        rqd: 2,
        type: [FormulaDataTypes.STRING, FormulaDataTypes.NUMERIC],
      },
    },
    description: 'Retrieve the last n characters from the input string.',
    syntax: 'RIGHT(str, n)',
    examples: ['RIGHT("HELLO WORLD", 5) => WORLD', 'RIGHT({column1}, 3)'],
    returnType: FormulaDataTypes.STRING,
  },
  LEFT: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#left`,

    validation: {
      args: {
        rqd: 2,
        type: [FormulaDataTypes.STRING, FormulaDataTypes.NUMERIC],
      },
    },
    description: 'Retrieve the first n characters from the input string.',
    syntax: 'LEFT(str, n)',
    examples: ['LEFT({column1}, 2)', 'LEFT("ABCD", 2) => "AB"'],
    returnType: FormulaDataTypes.STRING,
  },
  SUBSTR: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#substr`,

    validation: {
      args: {
        min: 2,
        max: 3,
        type: [
          FormulaDataTypes.STRING,
          FormulaDataTypes.NUMERIC,
          FormulaDataTypes.NUMERIC,
        ],
      },
    },
    description:
      'Extracts a substring of length "n" from the input string, starting from the specified position.',
    syntax: '	SUBTR(str, position, [n])',
    examples: [
      'SUBSTR("HELLO WORLD", 7) => WORLD',
      'SUBSTR("HELLO WORLD", 7, 3) => WOR',
      'SUBSTR({column1}, 7, 5)',
    ],
    returnType: FormulaDataTypes.STRING,
  },
  MID: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#mid`,

    validation: {
      args: {
        rqd: 3,
        type: [
          FormulaDataTypes.STRING,
          FormulaDataTypes.NUMERIC,
          FormulaDataTypes.NUMERIC,
        ],
      },
    },
    description: 'Extracts a substring; an alias for SUBSTR.',
    syntax: 'MID(str, position, [count])',
    examples: ['MID("NocoDB", 3, 2) => "co"', 'MID({column1}, 3, 2)'],
    returnType: FormulaDataTypes.STRING,
  },
  ISBLANK: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#isblank`,

    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Check if the input parameter is blank.',
    syntax: 'ISBLANK(value)',
    examples: ['ISBLANK({column1}) => false', 'ISBLANK("") => true'],
    returnType: FormulaDataTypes.BOOLEAN,
  },
  ISNOTBLANK: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#isnotblank`,

    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Check if the input parameter is not blank.',
    syntax: 'ISNOTBLANK(value)',
    examples: ['ISNOTBLANK({column1}) => true', 'ISNOTBLANK("") => false'],
    returnType: FormulaDataTypes.BOOLEAN,
  },
  IF: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/conditional-expressions#if`,

    validation: {
      args: {
        min: 2,
        max: 3,
      },
    },
    description:
      'Evaluate successCase if the expression is TRUE, else the failureCase.',
    syntax: 'IF(expr, successCase, failureCase)',
    examples: [
      'IF(5 > 1, "YES", "NO") => "YES"',
      'IF({column} > 1, "YES", "NO")',
    ],
    returnType: (argTypes: FormulaDataTypes[]) => {
      // extract all return types except NULL, since null can be returned by any type
      const returnValueTypes = new Set(
        argTypes.slice(1).filter((type) => type !== FormulaDataTypes.NULL)
      );
      // if there are more than one return types or if there is a string return type
      // return type as string else return the type
      if (
        returnValueTypes.size > 1 ||
        returnValueTypes.has(FormulaDataTypes.STRING)
      ) {
        return FormulaDataTypes.STRING;
      } else if (returnValueTypes.has(FormulaDataTypes.NUMERIC)) {
        return FormulaDataTypes.NUMERIC;
      } else if (returnValueTypes.has(FormulaDataTypes.BOOLEAN)) {
        return FormulaDataTypes.BOOLEAN;
      } else if (returnValueTypes.has(FormulaDataTypes.DATE)) {
        return FormulaDataTypes.DATE;
      }

      // if none of the above conditions are met, return the first return argument type
      return argTypes[1];
    },
  },
  SWITCH: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/conditional-expressions#switch`,

    validation: {
      args: {
        min: 3,
      },
      custom: (_argTypes: any[], _parseTree) => {
        // Todo: Add validation for switch
      },
    },
    description:
      'Evaluate case value based on expression output; if no match is found, evaluate default case.',
    syntax: 'SWITCH(expr, [pattern, value, ..., default])',
    examples: [
      'SWITCH(1, 1, "One", 2, "Two", "N/A") => "One""',
      'SWITCH(2, 1, "One", 2, "Two", "N/A") => "Two"',
      'SWITCH(3, 1, "One", 2, "Two", "N/A") => "N/A"',
      'SWITCH({column1}, 1, "One", 2, "Two", "N/A")',
    ],
    returnType: (argTypes: FormulaDataTypes[]) => {
      // extract all return types except NULL, since null can be returned by any type
      const returnValueTypes = new Set(
        argTypes.slice(2).filter((_, i) => i % 2 === 0)
      );

      // if there are more than one return types or if there is a string return type
      // return type as string else return the type
      if (
        returnValueTypes.size > 1 ||
        returnValueTypes.has(FormulaDataTypes.STRING)
      ) {
        return FormulaDataTypes.STRING;
      } else if (returnValueTypes.has(FormulaDataTypes.NUMERIC)) {
        return FormulaDataTypes.NUMERIC;
      } else if (returnValueTypes.has(FormulaDataTypes.BOOLEAN)) {
        return FormulaDataTypes.BOOLEAN;
      } else if (returnValueTypes.has(FormulaDataTypes.DATE)) {
        return FormulaDataTypes.DATE;
      }

      // if none of the above conditions are met, return the first return argument type
      return argTypes[1];
    },
  },
  URL: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#url`,

    validation: {
      args: {
        min: 1,
        max: 2,
        type: [FormulaDataTypes.STRING, FormulaDataTypes.STRING],
      },
    },
    description:
      'Verify and convert to a hyperlink if the input is a valid URL.',
    syntax: 'URL(string, [label])',
    examples: [
      'URL("https://github.com/nocodb/nocodb")',
      'URL({column1})',
      'URL("https://github.com/nocodb/nocodb", "NocoDB")',
      'URL({column1}, {column1})',
    ],
    returnType: FormulaDataTypes.STRING,
  },
  URLENCODE: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#urlencode`,

    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.STRING,
      },
    },
    description: 'Percent-encode the input parameter for use in URLs',
    syntax: 'URLENCODE(str)',
    examples: [
      'URLENCODE("Hello, world") => "Hello%2C%20world"',
      'URLENCODE({column1})',
    ],
    returnType: FormulaDataTypes.STRING,
  },
  WEEKDAY: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/date-functions#weekday`,

    validation: {
      args: {
        min: 1,
        max: 2,
        type: FormulaDataTypes.NUMERIC,
      },
      custom(_argTypes: FormulaDataTypes[], parsedTree: any) {
        if (parsedTree.arguments[0].type === JSEPNode.LITERAL) {
          if (!validateDateWithUnknownFormat(parsedTree.arguments[0].value)) {
            throw new FormulaError(
              FormulaErrorType.TYPE_MISMATCH,
              { key: 'msg.formula.firstParamWeekDayHaveDate' },
              'First parameter of WEEKDAY should be a date'
            );
          }
        }

        // if second argument is present and literal then validate it
        if (
          parsedTree.arguments[1] &&
          parsedTree.arguments[1].type === JSEPNode.LITERAL
        ) {
          const value = parsedTree.arguments[1].value;
          if (
            typeof value !== 'string' ||
            ![
              'sunday',
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
            ].includes(value.toLowerCase())
          ) {
            throw new FormulaError(
              FormulaErrorType.TYPE_MISMATCH,
              { key: 'msg.formula.secondParamWeekDayHaveDate' },
              'Second parameter of WEEKDAY should be day of week string'
            );
          }
        }
      },
    },
    description:
      'Retrieve the day of the week as an integer (0-6), starting from Monday by default.',
    syntax: 'WEEKDAY(date, [startDayOfWeek])',
    examples: ['WEEKDAY("2021-06-09")', 'WEEKDAY(NOW(), "sunday")'],
    returnType: FormulaDataTypes.NUMERIC,
  },

  TRUE: {
    validation: {
      args: {
        max: 0,
      },
    },
    description: 'Returns 1',
    syntax: 'TRUE()',
    examples: ['TRUE()'],
    returnType: FormulaDataTypes.NUMERIC,
    // TODO: Add docs url
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/logical-functions#true`,
  },

  FALSE: {
    validation: {
      args: {
        max: 0,
      },
    },
    description: 'Returns 0',
    syntax: 'FALSE()',
    examples: ['FALSE()'],
    returnType: FormulaDataTypes.NUMERIC,
    // TODO: Add docs url
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/logical-functions#false`,
  },

  ARRAYUNIQUE: {
    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.ARRAY,
      },
    },
    description: 'Return unique items from the given array',
    syntax: 'ARRAYUNIQUE(value)',
    examples: ['ARRAYUNIQUE({column})'],
    returnType: FormulaDataTypes.ARRAY,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/array-functions#arrayunique`,
  },

  ARRAYSORT: {
    validation: {
      args: {
        min: 1,
        max: 2,
      },
    },
    description: 'Sort an array result',
    syntax: 'ARRAYSORT(value, [direction])',
    examples: ['ARRAYSORT({column}, "desc")'],
    returnType: FormulaDataTypes.ARRAY,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/array-functions#arraysort`,
  },

  ARRAYCOMPACT: {
    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.ARRAY,
      },
    },
    description: 'Removes empty strings and null values from the array',
    syntax: 'ARRAYCOMPACT(value)',
    examples: ['ARRAYCOMPACT({column})'],
    returnType: FormulaDataTypes.ARRAY,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/array-functions#arraycompact`,
  },

  ARRAYSLICE: {
    validation: {
      args: {
        min: 2,
        max: 3,
      },
    },
    description: 'Removes empty strings and null values from the array',
    syntax: 'ARRAYSLICE(value, start, [end])',
    examples: ['ARRAYSLICE({column})'],
    returnType: FormulaDataTypes.ARRAY,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/array-functions#arrayslice`,
  },

  REGEX_MATCH: {
    validation: {
      args: {
        rqd: 2,
        type: FormulaDataTypes.STRING,
      },
    },
    description:
      'Verifies whether the input text matches a regular expression, returning 1 for a match and 0 otherwise.',
    syntax: 'REGEX_MATCH(string, regex)',
    examples: ['REGEX_MATCH({title}, "abc.*")'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#regex_match`,
  },

  REGEX_EXTRACT: {
    validation: {
      args: {
        rqd: 2,
        type: FormulaDataTypes.STRING,
      },
    },
    description:
      'Retrieve the first match of a regular expression in a string.',
    syntax: 'REGEX_EXTRACT(string, regex)',
    examples: ['REGEX_EXTRACT({title}, "abc.*")'],
    returnType: FormulaDataTypes.STRING,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#regex_extract`,
  },
  REGEX_REPLACE: {
    validation: {
      args: {
        rqd: 3,
        type: FormulaDataTypes.STRING,
      },
    },
    description:
      'Replace all occurrences of a regular expression in a string with a specified replacement string.',
    syntax: 'REGEX_MATCH(string, regex, replacement)',
    examples: ['REGEX_EXTRACT({title}, "abc.*", "abcd")'],
    returnType: FormulaDataTypes.STRING,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/string-functions#regex_replace`,
  },
  BLANK: {
    validation: {
      args: {
        rqd: 0,
      },
    },
    description: 'Yields a null value.',
    syntax: 'BLANK()',
    examples: ['BLANK()'],
    returnType: FormulaDataTypes.NULL,
    // TODO: Add docs url
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/logical-functions#blank`,
  },
  XOR: {
    validation: {
      args: {
        min: 1,
      },
      // todo: validation for boolean
    },
    description:
      'Verifies whether an odd number of arguments are true, returning true if so, and false otherwise.',
    syntax: 'XOR(expression, [exp2, ...])',
    examples: ['XOR(TRUE(), FALSE(), TRUE())'],
    returnType: FormulaDataTypes.BOOLEAN,
    // TODO: Add docs url
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/logical-functions#xor`,
  },
  EVEN: {
    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description:
      'Rounds up the specified value to the nearest even integer that is greater than or equal to the specified value',
    syntax: 'EVEN(value)',
    examples: ['EVEN({column})'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#even`,
  },
  ODD: {
    validation: {
      args: {
        rqd: 1,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description:
      'Rounds up the specified value to the nearest odd integer that is greater than or equal to the specified value',
    syntax: 'ODD(value)',
    examples: ['ODD({column})'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#odd`,
  },
  RECORD_ID: {
    validation: {
      args: {
        rqd: 0,
      },
    },
    description: 'Retrieve the record ID of the current record.',
    syntax: 'RECORD_ID()',
    examples: ['RECORD_ID()'],

    // todo: resolve return type based on the args
    returnType: () => {
      return FormulaDataTypes.STRING;
    },
  },
  COUNTA: {
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Counts non-empty arguments',
    syntax: 'COUNTA(value1, [value2, ...])',
    examples: ['COUNTA({field1}, {field2})'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#counta`,
  },
  COUNT: {
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Counts numerical arguments',
    syntax: 'COUNT(value1, [value2, ...])',
    examples: ['COUNT({field1}, {field2})'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#count`,
  },
  COUNTALL: {
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Counts the number of arguments',
    syntax: 'COUNTALL(value1, [value2, ...])',
    examples: ['COUNTALL({field1}, {field2})'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#countall`,
  },
  ROUNDDOWN: {
    validation: {
      args: {
        min: 1,
        max: 2,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description:
      'Rounds down the value after the decimal point to the specified number of decimal places given by "precision" (default is 0).',
    syntax: 'ROUNDDOWN(value, [precision])',
    examples: ['ROUNDDOWN({field1})', 'ROUNDDOWN({field1}, 2)'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#rounddown`,
  },
  ROUNDUP: {
    validation: {
      args: {
        min: 1,
        max: 2,
        type: FormulaDataTypes.NUMERIC,
      },
    },
    description:
      'Rounds up the value after the decimal point to the specified number of decimal places given by "precision" (default is 0).',
    syntax: 'ROUNDUP(value, [precision])',
    examples: ['ROUNDUP({field1})', 'ROUNDUP({field1}, 2)'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#roundup`,
  },
  VALUE: {
    validation: {
      args: {
        rqd: 1,
      },
    },
    description:
      'Extracts the numeric value from a string, handling % or - appropriately, and returns the resulting numeric value.',
    syntax: 'VALUE(value)',
    examples: ['VALUE({field})', 'VALUE("abc10000%")', 'VALUE("$10000")'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/numeric-functions#value`,
  },
  JSON_EXTRACT: {
    docsUrl: `${API_DOC_PREFIX}/field-types/formula/json-functions#json_extract`,
    validation: {
      args: {
        min: 2,
        max: 2,
        type: [FormulaDataTypes.STRING, FormulaDataTypes.STRING],
      },
    },
    description: 'Extracts a value from a JSON string using a jq-like syntax',
    syntax: 'JSON_EXTRACT(json_string, path)',
    examples: [
      'JSON_EXTRACT(\'{"a": {"b": "c"}}\', \'.a.b\') => "c"',
      "JSON_EXTRACT({json_column}, '.key')",
    ],
    returnType: FormulaDataTypes.STRING,
  },
  // Disabling these functions for now; these act as alias for CreatedAt & UpdatedAt fields;
  // Issue: Error noticed if CreatedAt & UpdatedAt fields are removed from the table after creating these formulas
  //
  // CREATED_TIME: {
  //   validation: {
  //     args: {
  //       rqd: 0,
  //     },
  //   },
  //   description: 'Returns the created time of the current record if it exists',
  //   syntax: 'CREATED_TIME()',
  //   examples: ['CREATED_TIME()'],
  // },
  // LAST_MODIFIED_TIME: {
  //   validation: {
  //     args: {
  //       rqd: 0,
  //     },
  //   },
  //   description: 'Returns the last modified time of the current record if it exists',
  //   syntax: ' LAST_MODIFIED_TIME()',
  //   examples: [' LAST_MODIFIED_TIME()'],
  // },
};
