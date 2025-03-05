import jsep from 'jsep';

import {
  ColumnType,
  FormulaType,
  LinkToAnotherRecordType,
  LookupType,
  RollupType,
  TableType,
} from './Api';
import UITypes from './UITypes';
import dayjs from 'dayjs';
import { SqlUiFactory } from './sqlUi';
import { dateFormats } from './dateTimeHelper';

type SqlUI = ReturnType<(typeof SqlUiFactory)['create']>;
type ClientTypeOrSqlUI =
  | 'mysql'
  | 'pg'
  | 'sqlite3'
  | 'mssql'
  | 'mysql2'
  | 'oracledb'
  | 'mariadb'
  | 'sqlite'
  | 'snowflake'
  | SqlUI;

export const StringOperators = ['||', '&'] as const;
export const ArithmeticOperators = ['+', '-', '*', '/'] as const;
export const ComparisonOperators = [
  '==',
  '=',
  '<',
  '>',
  '<=',
  '>=',
  '!=',
] as const;
export type ArithmeticOperator = (typeof ArithmeticOperators)[number];
export type ComparisonOperator = (typeof ComparisonOperators)[number];
export type StringOperator = (typeof StringOperators)[number];
export type BaseFormulaNode = {
  type: JSEPNode;
  dataType?: FormulaDataTypes;
  cast?: FormulaDataTypes;
  errors?: Set<string>;
};

export interface BinaryExpressionNode extends BaseFormulaNode {
  operator: ArithmeticOperator | ComparisonOperator | StringOperator;
  type: JSEPNode.BINARY_EXP;
  right: ParsedFormulaNode;
  left: ParsedFormulaNode;
}

export interface CallExpressionNode extends BaseFormulaNode {
  type: JSEPNode.CALL_EXP;
  arguments: ParsedFormulaNode[];
  callee: {
    type?: string;
    name: string;
  };
}

export interface IdentifierNode extends BaseFormulaNode {
  type: JSEPNode.IDENTIFIER;
  name: string;
  raw: string;
}

export interface LiteralNode extends BaseFormulaNode {
  type: JSEPNode.LITERAL;
  value: string | number;
  raw: string;
}

export interface UnaryExpressionNode extends BaseFormulaNode {
  type: JSEPNode.UNARY_EXP;
  operator: string;
  argument: ParsedFormulaNode;
}

export interface ArrayExpressionNode extends BaseFormulaNode {
  type: JSEPNode.ARRAY_EXP;
}

export interface MemberExpressionNode extends BaseFormulaNode {
  type: JSEPNode.MEMBER_EXP;
}

export interface CompoundNode extends BaseFormulaNode {
  type: JSEPNode.COMPOUND;
}

export type ParsedFormulaNode =
  | BinaryExpressionNode
  | CallExpressionNode
  | IdentifierNode
  | LiteralNode
  | MemberExpressionNode
  | ArrayExpressionNode
  | UnaryExpressionNode
  | CompoundNode;

// opening and closing string code
const OCURLY_CODE = 123; // '{'
const CCURLY_CODE = 125; // '}'

export const jsepCurlyHook = {
  name: 'curly',
  init(jsep) {
    // Match identifier in following pattern: {abc-cde}
    jsep.hooks.add('gobble-token', function escapedIdentifier(env) {
      // check if the current token is an opening curly bracket
      if (this.code === OCURLY_CODE) {
        const patternIndex = this.index;
        // move to the next character until we find a closing curly bracket
        while (this.index < this.expr.length) {
          ++this.index;
          if (this.code === CCURLY_CODE) {
            let identifier = this.expr.slice(patternIndex, ++this.index);

            // if starting with double curley brace then check for ending double curley brace
            // if found include with the identifier
            if (
              identifier.startsWith('{{') &&
              this.expr.slice(patternIndex, this.index + 1).endsWith('}')
            ) {
              identifier = this.expr.slice(patternIndex, ++this.index);
            }
            env.node = {
              type: jsep.IDENTIFIER,
              name: /^{{.*}}$/.test(identifier)
                ? // start would be the position of the first curly bracket
                  // add 2 to point to the first character for expressions like {{col1}}
                  identifier.slice(2, -2)
                : // start would be the position of the first curly bracket
                  // add 1 to point to the first character for expressions like {col1}
                  identifier.slice(1, -1),
              raw: identifier,
            };

            // env.node = this.gobbleTokenProperty(env.node);
            return env.node;
          }
        }
        this.throwError('Unclosed }');
      }
    });
  },
} as jsep.IPlugin;

function validateDateWithUnknownFormat(v: string) {
  for (const format of dateFormats) {
    if (dayjs(v, format, true).isValid() as any) {
      return true;
    }
    for (const timeFormat of ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS']) {
      if (dayjs(v, `${format} ${timeFormat}`, true).isValid() as any) {
        return true;
      }
    }
  }
  return false;
}

export async function substituteColumnAliasWithIdInFormula(
  formula,
  columns: ColumnType[]
) {
  const substituteId = async (pt: any) => {
    if (pt.type === 'CallExpression') {
      for (const arg of pt.arguments || []) {
        await substituteId(arg);
      }
    } else if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt.name;
      const column = columns.find(
        (c) =>
          c.id === colNameOrId ||
          c.column_name === colNameOrId ||
          c.title === colNameOrId
      );
      pt.name = '{' + column.id + '}';
    } else if (pt.type === 'BinaryExpression') {
      await substituteId(pt.left);
      await substituteId(pt.right);
    }
  };
  // register jsep curly hook
  jsep.plugins.register(jsepCurlyHook);
  const parsedFormula = jsep(formula);
  await substituteId(parsedFormula);
  return jsepTreeToFormula(parsedFormula);
}

export enum FormulaErrorType {
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  MIN_ARG = 'MIN_ARG',
  MAX_ARG = 'MAX_ARG',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  INVALID_ARG = 'INVALID_ARG',
  INVALID_ARG_TYPE = 'INVALID_ARG_TYPE',
  INVALID_ARG_VALUE = 'INVALID_ARG_VALUE',
  INVALID_ARG_COUNT = 'INVALID_ARG_COUNT',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  INVALID_FUNCTION_NAME = 'INVALID_FUNCTION_NAME',
  INVALID_COLUMN = 'INVALID_COLUMN',
}

export function substituteColumnIdWithAliasInFormula(
  formula,
  columns: ColumnType[],
  rawFormula?
) {
  const substituteId = (pt: any, ptRaw?: any) => {
    if (pt.type === 'CallExpression') {
      let i = 0;
      for (const arg of pt.arguments || []) {
        substituteId(arg, ptRaw?.arguments?.[i++]);
      }
    } else if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt?.name;
      const column = columns.find(
        (c) =>
          c.id === colNameOrId ||
          c.column_name === colNameOrId ||
          c.title === colNameOrId
      );
      pt.name = column?.title || ptRaw?.name || pt?.name;
    } else if (pt.type === 'BinaryExpression') {
      substituteId(pt.left, ptRaw?.left);
      substituteId(pt.right, ptRaw?.right);
    }
  };

  // register jsep curly hook
  jsep.plugins.register(jsepCurlyHook);
  const parsedFormula = jsep(formula);
  const parsedRawFormula = rawFormula && jsep(rawFormula);
  substituteId(parsedFormula, parsedRawFormula);
  return jsepTreeToFormula(parsedFormula);
}

// isCallExpId - is the identifier part of a call expression
// in case of call expression, we don't want to wrap the identifier in curly brackets
export function jsepTreeToFormula(node, isCallExpId = false) {
  if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
    return (
      '(' +
      jsepTreeToFormula(node.left) +
      ' ' +
      node.operator +
      ' ' +
      jsepTreeToFormula(node.right) +
      ')'
    );
  }

  if (node.type === 'UnaryExpression') {
    return node.operator + jsepTreeToFormula(node.argument);
  }

  if (node.type === 'MemberExpression') {
    return (
      jsepTreeToFormula(node.object) +
      '[' +
      jsepTreeToFormula(node.property) +
      ']'
    );
  }

  if (node.type === 'Identifier') {
    if (!isCallExpId) return '{' + node.name + '}';
    return node.name;
  }

  if (node.type === 'Literal') {
    if (typeof node.value === 'string') {
      return String.raw`"${escapeLiteral(node.raw.slice(1, -1))}"`;
    }
    return '' + node.value;
  }

  if (node.type === 'CallExpression') {
    return (
      jsepTreeToFormula(node.callee, true) +
      '(' +
      node.arguments.map((argPt) => jsepTreeToFormula(argPt)).join(', ') +
      ')'
    );
  }

  if (node.type === 'ArrayExpression') {
    return (
      '[' +
      node.elements.map((elePt) => jsepTreeToFormula(elePt)).join(', ') +
      ']'
    );
  }

  if (node.type === 'Compound') {
    return node.body.map((e) => jsepTreeToFormula(e)).join(' ');
  }

  if (node.type === 'ConditionalExpression') {
    return (
      jsepTreeToFormula(node.test) +
      ' ? ' +
      jsepTreeToFormula(node.consequent) +
      ' : ' +
      jsepTreeToFormula(node.alternate)
    );
  }

  return '';
}

function escapeLiteral(v: string) {
  return (
    v
      // replace \ to \\, escape only unescaped \
      .replace(/([^\\]|^)\\(?!\\)/g, `$1\\\\`)
      // replace " to \"
      .replace(/([^\\]|^)"/g, `$1\\"`)
      // replace ' to \'
      .replace(/([^\\]|^)'/g, `$1\\'`)
  );
}

export enum FormulaDataTypes {
  NUMERIC = 'numeric',
  STRING = 'string',
  DATE = 'date',
  LOGICAL = 'logical',
  COND_EXP = 'conditional_expression',
  NULL = 'null',
  BOOLEAN = 'boolean',
  INTERVAL = 'interval',
  UNKNOWN = 'unknown',
}

export enum JSEPNode {
  COMPOUND = 'Compound',
  IDENTIFIER = 'Identifier',
  MEMBER_EXP = 'MemberExpression',
  LITERAL = 'Literal',
  THIS_EXP = 'ThisExpression',
  CALL_EXP = 'CallExpression',
  UNARY_EXP = 'UnaryExpression',
  BINARY_EXP = 'BinaryExpression',
  ARRAY_EXP = 'ArrayExpression',
}

interface FormulaMeta {
  validation?: {
    args?: {
      min?: number;
      max?: number;
      rqd?: number;

      // array of allowed types when args types are not same
      // types should be in order of args
      type?: FormulaDataTypes | FormulaDataTypes[];
    };
    custom?: (args: FormulaDataTypes[], parseTree: any) => void;
  };
  description?: string;
  syntax?: string;
  examples?: string[];
  returnType?: ((args: any[]) => FormulaDataTypes) | FormulaDataTypes;
  docsUrl?: string;
}

export const formulas: Record<string, FormulaMeta> = {
  AVG: {
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#avg',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#add',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/date-functions#dateadd',
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
            !['day', 'week', 'month', 'year'].includes(
              parsedTree.arguments[2].value
            )
          ) {
            throw new FormulaError(
              FormulaErrorType.TYPE_MISMATCH,
              { key: 'msg.formula.thirdParamDateAddHaveDate' },
              "Third parameter of DATEADD should be one of 'day', 'week', 'month', 'year'"
            );
          }
        }
      },
    },
    description: 'Adds "count" units to Datetime.',
    syntax:
      'DATEADD(date | datetime, count, ["day" | "week" | "month" | "year"])',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/date-functions#datestr',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/date-functions#day',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/date-functions#month',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/date-functions#year',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/date-functions#hour',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/date-functions#datetime_diff',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/conditional-expressions#and',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/conditional-expressions#or',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#concat',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#trim',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#upper',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#lower',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#len',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#min',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#max',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#ceiling',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#floor',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#round',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#mod',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#repeat',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#log',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#exp',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#power',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#sqrt',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#abs',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/date-functions#now',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#replace',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#search',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#int',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#right',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#left',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#substr',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#mid',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#isblank',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#isnotblank',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/conditional-expressions#if',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/conditional-expressions#switch',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#url',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#urlencode',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/date-functions#weekday',

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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/logical-functions#true',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/logical-functions#false',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#regex_match',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#regex_extract',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/string-functions#regex_replace',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/logical-functions#blank',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/logical-functions#xor',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#even',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#odd',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#counta',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#count',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#countall',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#rounddown',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#roundup',
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
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/numeric-functions#value',
  },
  JSON_EXTRACT: {
    docsUrl:
      'https://docs.nocodb.com/fields/field-types/formula/json-functions#json_extract',
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

export class FormulaError extends Error {
  public type: FormulaErrorType;
  public extra: Record<string, any>;

  constructor(
    type: FormulaErrorType,
    extra: {
      [key: string]: any;
    },
    message: string = 'Formula Error'
  ) {
    super(message);
    this.type = type;
    this.extra = extra;
  }
}

async function extractColumnIdentifierType({
  col,
  columns,
  getMeta,
  clientOrSqlUi,
}: {
  col: Record<string, any>;
  columns: ColumnType[];
  getMeta: (tableId: string) => Promise<any>;
  clientOrSqlUi: ClientTypeOrSqlUI;
}) {
  const res: {
    dataType?: FormulaDataTypes;
    errors?: Set<string>;
    [p: string]: any;
  } = {};
  const sqlUI =
    typeof clientOrSqlUi === 'string'
      ? SqlUiFactory.create({ client: clientOrSqlUi })
      : clientOrSqlUi;

  switch (col?.uidt) {
    // string
    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.MultiSelect:
    case UITypes.SingleSelect:
    case UITypes.PhoneNumber:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy:
      res.dataType = FormulaDataTypes.STRING;
      break;
    // numeric
    case UITypes.Year:
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Rating:
    case UITypes.Count:
    case UITypes.AutoNumber:
      res.dataType = FormulaDataTypes.NUMERIC;
      break;
    // date
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      res.dataType = FormulaDataTypes.DATE;
      break;

    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Links:
      res.dataType = FormulaDataTypes.NUMERIC;
      break;

    case UITypes.Rollup:
      {
        const rollupFunction = col.colOptions.rollup_function;
        if (
          [
            'count',
            'avg',
            'sum',
            'countDistinct',
            'sumDistinct',
            'avgDistinct',
          ].includes(rollupFunction)
        ) {
          // these functions produce a numeric value, which can be used in numeric functions
          res.dataType = FormulaDataTypes.NUMERIC;
        } else {
          const relationColumnOpt = columns.find(
            (column) =>
              column.id === (<RollupType>col.colOptions).fk_relation_column_id
          );

          // the value is based on the foreign rollup column type
          const refTableMeta = await getMeta(
            (<LinkToAnotherRecordType>relationColumnOpt.colOptions)
              .fk_related_model_id
          );

          const refTableColumns = refTableMeta.columns;
          const childFieldColumn = refTableColumns.find(
            (column: ColumnType) =>
              column.id === col.colOptions.fk_rollup_column_id
          );

          // extract type and add to res
          Object.assign(
            res,
            await extractColumnIdentifierType({
              col: childFieldColumn,
              columns: refTableColumns,
              getMeta,
              clientOrSqlUi,
            })
          );
        }
      }
      break;

    case UITypes.Attachment:
      res.dataType = FormulaDataTypes.STRING;
      break;
    case UITypes.Checkbox:
      if (col.dt === 'boolean' || col.dt === 'bool') {
        res.dataType = FormulaDataTypes.BOOLEAN;
      } else {
        res.dataType = FormulaDataTypes.NUMERIC;
      }
      break;
    case UITypes.Time:
      res.dataType = FormulaDataTypes.INTERVAL;
      break;
    case UITypes.ID:
    case UITypes.ForeignKey:
    case UITypes.SpecificDBType:
      {
        if (sqlUI) {
          const abstractType = sqlUI.getAbstractType(col);
          if (['integer', 'float', 'decimal'].includes(abstractType)) {
            res.dataType = FormulaDataTypes.NUMERIC;
          } else if (['boolean'].includes(abstractType)) {
            res.dataType = FormulaDataTypes.BOOLEAN;
          } else if (
            ['date', 'datetime', 'time', 'year'].includes(abstractType)
          ) {
            res.dataType = FormulaDataTypes.DATE;
          } else {
            res.dataType = FormulaDataTypes.STRING;
          }
        } else {
          res.dataType = FormulaDataTypes.UNKNOWN;
        }
      }
      break;
    // not supported
    case UITypes.Lookup:
    case UITypes.Barcode:
    case UITypes.Button:
    case UITypes.Collaborator:
    case UITypes.QrCode:
    default:
      res.dataType = FormulaDataTypes.UNKNOWN;
      break;
  }

  return res;
}

export async function validateFormulaAndExtractTreeWithType({
  formula,
  column,
  columns,
  clientOrSqlUi,
  getMeta,
}: {
  formula: string;
  columns: ColumnType[];
  clientOrSqlUi: ClientTypeOrSqlUI;
  column?: ColumnType;
  getMeta: (tableId: string) => Promise<any>;
}): Promise<ParsedFormulaNode> {
  const sqlUI =
    typeof clientOrSqlUi === 'string'
      ? SqlUiFactory.create({ client: clientOrSqlUi })
      : clientOrSqlUi;

  const colAliasToColMap = {};
  const colIdToColMap = {};

  for (const col of columns) {
    colAliasToColMap[col.title] = col;
    colIdToColMap[col.id] = col;
  }

  const validateAndExtract = async (
    parsedTree: ParsedFormulaNode
  ): Promise<ParsedFormulaNode> => {
    const res: ParsedFormulaNode = { ...parsedTree };

    if (parsedTree.type === JSEPNode.CALL_EXP) {
      const calleeName = (
        parsedTree.callee as IdentifierNode
      ).name.toUpperCase();
      // validate function name
      if (!formulas[calleeName]) {
        throw new FormulaError(
          FormulaErrorType.INVALID_FUNCTION_NAME,
          {},
          `Function ${calleeName} is not available`
        );
      } else if (sqlUI?.getUnsupportedFnList().includes(calleeName)) {
        throw new FormulaError(
          FormulaErrorType.INVALID_FUNCTION_NAME,
          {},
          `Function ${calleeName} is unavailable for your database`
        );
      }

      // validate arguments
      const validation =
        formulas[calleeName] && formulas[calleeName].validation;
      if (validation && validation.args) {
        if (
          validation.args.rqd !== undefined &&
          validation.args.rqd !== parsedTree.arguments.length
        ) {
          throw new FormulaError(
            FormulaErrorType.INVALID_ARG,
            {
              key: 'msg.formula.requiredArgumentsFormula',
              requiredArguments: validation.args.rqd,
              calleeName,
            },
            'Required arguments missing'
          );
        } else if (
          validation.args.min !== undefined &&
          validation.args.min > parsedTree.arguments.length
        ) {
          throw new FormulaError(
            FormulaErrorType.MIN_ARG,
            {
              key: 'msg.formula.minRequiredArgumentsFormula',
              minRequiredArguments: validation.args.min,
              calleeName,
            },
            'Minimum arguments required'
          );
        } else if (
          validation.args.max !== undefined &&
          validation.args.max < parsedTree.arguments.length
        ) {
          throw new FormulaError(
            FormulaErrorType.INVALID_ARG,
            {
              key: 'msg.formula.maxRequiredArgumentsFormula',
              maxRequiredArguments: validation.args.max,
              calleeName,
            },
            'Maximum arguments missing'
          );
        }
      }
      // get args type and validate
      const validateResult = ((res as CallExpressionNode).arguments =
        await Promise.all(
          parsedTree.arguments.map((arg) => {
            return validateAndExtract(arg);
          })
        ));

      const argTypes = validateResult.map((v: any) => v.dataType);

      // if validation function is present, call it
      if (formulas[calleeName].validation?.custom) {
        formulas[calleeName].validation?.custom(argTypes, parsedTree);
      }
      // validate against expected arg types if present
      else if (formulas[calleeName].validation?.args?.type) {
        for (let i = 0; i < validateResult.length; i++) {
          const argPt = validateResult[i];

          // if type
          const expectedArgType = Array.isArray(
            formulas[calleeName].validation.args.type
          )
            ? formulas[calleeName].validation.args.type[i]
            : formulas[calleeName].validation.args.type;

          if (
            argPt.dataType !== expectedArgType &&
            argPt.dataType !== FormulaDataTypes.NULL &&
            argPt.dataType !== FormulaDataTypes.UNKNOWN &&
            expectedArgType !== FormulaDataTypes.STRING
          ) {
            if (argPt.type === JSEPNode.IDENTIFIER) {
              const name =
                columns?.find(
                  (c) => c.id === argPt.name || c.title === argPt.name
                )?.title || argPt.name;

              throw new FormulaError(
                FormulaErrorType.INVALID_ARG,
                {
                  key: 'msg.formula.columnWithTypeFoundButExpected',
                  columnName: name,
                  columnType: argPt.dataType,
                  expectedType: expectedArgType,
                },
                `Field ${name} with ${argPt.dataType} type is found but ${expectedArgType} type is expected`
              );
            } else {
              let key = '';
              const position = i + 1;
              let type = '';

              if (expectedArgType === FormulaDataTypes.NUMERIC) {
                key = 'msg.formula.typeIsExpected';
                type = 'numeric';
              } else if (expectedArgType === FormulaDataTypes.BOOLEAN) {
                key = 'msg.formula.typeIsExpected';
                type = 'boolean';
              } else if (expectedArgType === FormulaDataTypes.DATE) {
                key = 'msg.formula.typeIsExpected';
                type = 'date';
              }

              throw new FormulaError(
                FormulaErrorType.INVALID_ARG,
                {
                  type,
                  key,
                  position,
                  calleeName,
                },
                `${calleeName?.toUpperCase()} requires a ${
                  type || expectedArgType
                } at position ${position}`
              );
            }
          }

          // if expected type is string and arg type is not string, then cast it to string
          if (
            expectedArgType === FormulaDataTypes.STRING &&
            expectedArgType !== argPt.dataType
          ) {
            argPt.cast = FormulaDataTypes.STRING;
          }
        }
      }

      if (typeof formulas[calleeName].returnType === 'function') {
        res.dataType = (formulas[calleeName].returnType as any)?.(
          argTypes
        ) as FormulaDataTypes;
      } else if (formulas[calleeName].returnType) {
        res.dataType = formulas[calleeName].returnType as FormulaDataTypes;
      }
    } else if (parsedTree.type === JSEPNode.IDENTIFIER) {
      const col = (colIdToColMap[(parsedTree as IdentifierNode).name] ||
        colAliasToColMap[(parsedTree as IdentifierNode).name]) as Record<
        string,
        any
      >;

      if (!col) {
        throw new FormulaError(
          FormulaErrorType.INVALID_COLUMN,
          {
            key: 'msg.formula.columnNotAvailable',
            columnName: (parsedTree as IdentifierNode).name,
          },
          `Invalid column name/id ${JSON.stringify(
            (parsedTree as IdentifierNode).name
          )} in formula`
        );
      }

      (res as IdentifierNode).name = col.id;

      if (col?.uidt === UITypes.Formula) {
        if (column) {
          // check for circular reference when column is present(only available when calling root formula)
          await checkForCircularFormulaRef(
            column,
            parsedTree,
            columns,
            getMeta
          );
        }
        const formulaRes =
          (col.colOptions as FormulaType).parsed_tree ||
          (await validateFormulaAndExtractTreeWithType(
            // formula may include double curly brackets in previous version
            // convert to single curly bracket here for compatibility
            {
              formula: col.colOptions.formula
                .replaceAll('{{', '{')
                .replaceAll('}}', '}'),
              columns,
              clientOrSqlUi,
              getMeta,
            }
          ));

        res.dataType = (formulaRes as ParsedFormulaNode)?.dataType;
      } else {
        if (
          col?.uidt === UITypes.Lookup ||
          col?.uidt === UITypes.LinkToAnotherRecord
        ) {
          // check for circular reference when column is present(only available when calling root formula)
          if (column) {
            await checkForCircularFormulaRef(
              column,
              parsedTree,
              columns,
              getMeta
            );
          }
        }

        // extract type and add to res
        Object.assign(
          res,
          await extractColumnIdentifierType({
            col,
            columns,
            getMeta,
            clientOrSqlUi,
          })
        );
      }
    } else if (parsedTree.type === JSEPNode.LITERAL) {
      if (typeof parsedTree.value === 'number') {
        res.dataType = FormulaDataTypes.NUMERIC;
      } else if (typeof parsedTree.value === 'string') {
        res.dataType = FormulaDataTypes.STRING;
      } else if (typeof parsedTree.value === 'boolean') {
        res.dataType = FormulaDataTypes.BOOLEAN;
      } else {
        res.dataType = FormulaDataTypes.STRING;
      }
    } else if (parsedTree.type === JSEPNode.UNARY_EXP) {
      // only support -ve values
      if (
        ['-'].includes(parsedTree.operator) &&
        parsedTree.argument.type === JSEPNode.LITERAL &&
        typeof parsedTree.argument.value === 'number'
      ) {
        res.dataType = FormulaDataTypes.NUMERIC;
      } else {
        throw new FormulaError(
          FormulaErrorType.NOT_SUPPORTED,
          {},
          `Unary expression '${parsedTree.operator}' is not supported`
        );
      }
    } else if (parsedTree.type === JSEPNode.BINARY_EXP) {
      (res as BinaryExpressionNode).left = await validateAndExtract(
        parsedTree.left
      );
      (res as BinaryExpressionNode).right = await validateAndExtract(
        parsedTree.right
      );

      const dateAndTimeParsedNode = handleBinaryExpressionForDateAndTime({
        sourceBinaryNode: res as any,
      });
      if (dateAndTimeParsedNode) {
        Object.assign(
          res,
          handleBinaryExpressionForDateAndTime({ sourceBinaryNode: res as any })
        );
        if (res.type !== JSEPNode.BINARY_EXP) {
          (res as any).left = undefined;
          (res as any).right = undefined;
          (res as any).operator = undefined;
        }
      } else if (
        ['==', '<', '>', '<=', '>=', '!='].includes(parsedTree.operator)
      ) {
        res.dataType = FormulaDataTypes.COND_EXP;
      } else if (parsedTree.operator === '+') {
        res.dataType = FormulaDataTypes.NUMERIC;
        // if any side is string/date/other type, then the result will be concatenated string
        // e.g. 1 + '2' = '12'
        if (
          [
            (res as BinaryExpressionNode).left,
            (res as BinaryExpressionNode).right,
          ].some(
            (r) =>
              ![
                FormulaDataTypes.NUMERIC,
                FormulaDataTypes.BOOLEAN,
                FormulaDataTypes.NULL,
                FormulaDataTypes.UNKNOWN,
              ].includes(r.dataType)
          )
        ) {
          res.dataType = FormulaDataTypes.STRING;
        }
      } else if (['&'].includes(parsedTree.operator)) {
        res.dataType = FormulaDataTypes.STRING;
      } else {
        res.dataType = FormulaDataTypes.NUMERIC;
      }
    } else if (parsedTree.type === JSEPNode.MEMBER_EXP) {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        {},
        'Bracket notation is not supported'
      );
    } else if (parsedTree.type === JSEPNode.ARRAY_EXP) {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        {},
        'Array is not supported'
      );
    } else if (parsedTree.type === JSEPNode.COMPOUND) {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        {},
        'Compound statement is not supported'
      );
    }
    return res;
  };

  // register jsep curly hook
  jsep.plugins.register(jsepCurlyHook);
  const parsedFormula = jsep(formula);
  // TODO: better jsep expression handling
  const result = await validateAndExtract(
    parsedFormula as unknown as ParsedFormulaNode
  );
  return result;
}

function handleBinaryExpressionForDateAndTime(params: {
  sourceBinaryNode: BinaryExpressionNode;
}): BinaryExpressionNode | CallExpressionNode | undefined {
  const { sourceBinaryNode } = params;
  let res: BinaryExpressionNode | CallExpressionNode;

  if (
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.left.dataType
    ) &&
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.right.dataType
    ) &&
    sourceBinaryNode.operator === '-'
  ) {
    // when it's interval and interval, we return diff in minute (numeric)
    if (
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.left.dataType) &&
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.right.dataType)
    ) {
      res = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.left,
          sourceBinaryNode.right,
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
    }
    // when it's date - date, show the difference in minute
    else if (
      [FormulaDataTypes.DATE].includes(sourceBinaryNode.left.dataType) &&
      [FormulaDataTypes.DATE].includes(sourceBinaryNode.right.dataType)
    ) {
      res = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.left,
          sourceBinaryNode.right,
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
    }
    // else interval and date can be addedd seamlessly A - B
    // with result as DATE
    // may be changed if we find other db use case
    else if (
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.left.dataType
      ) &&
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.right.dataType
      ) &&
      sourceBinaryNode.left.dataType != sourceBinaryNode.right.dataType
    ) {
      res = {
        type: JSEPNode.BINARY_EXP,
        left: sourceBinaryNode.left,
        right: sourceBinaryNode.right,
        operator: '-',
        dataType: FormulaDataTypes.DATE,
      } as BinaryExpressionNode;
    }
  } else if (
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.left.dataType
    ) &&
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.right.dataType
    ) &&
    sourceBinaryNode.operator === '+'
  ) {
    // when it's interval and interval, we return addition in minute (numeric)
    if (
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.left.dataType) &&
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.right.dataType)
    ) {
      const left = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.left,
          {
            type: 'Literal',
            value: '00:00:00',
            raw: '"00:00:00"',
            dataType: FormulaDataTypes.INTERVAL,
          },
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
      const right = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.right,
          {
            type: 'Literal',
            value: '00:00:00',
            raw: '"00:00:00"',
            dataType: FormulaDataTypes.INTERVAL,
          },
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
      return {
        type: JSEPNode.BINARY_EXP,
        left,
        right,
        operator: '+',
        dataType: FormulaDataTypes.NUMERIC,
      } as BinaryExpressionNode;
    }
    // else interval and date can be addedd seamlessly A + B
    // with result as DATE
    // may be changed if we find other db use case
    else if (
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.left.dataType
      ) &&
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.right.dataType
      ) &&
      sourceBinaryNode.left.dataType != sourceBinaryNode.right.dataType
    ) {
      res = {
        type: JSEPNode.BINARY_EXP,
        left: sourceBinaryNode.left,
        right: sourceBinaryNode.right,
        operator: '+',
        dataType: FormulaDataTypes.DATE,
      } as BinaryExpressionNode;
    }
  }
  return res;
}
async function checkForCircularFormulaRef(
  formulaCol: ColumnType,
  parsedTree: ParsedFormulaNode,
  columns: ColumnType[],
  getMeta: (tableId: string) => Promise<TableType & { columns: ColumnType[] }>
) {
  // Extract formula references
  const formulaPaths = await columns.reduce(async (promiseRes, c) => {
    const res = await promiseRes;
    if (c.id !== formulaCol.id && c.uidt === UITypes.Formula) {
      const neighbours = [
        ...new Set(
          (
            (c.colOptions as FormulaType).formula.match(/c_?\w{14,15}/g) || []
          ).filter((colId) =>
            columns.some(
              (col) => col.id === colId && col.uidt === UITypes.Formula
            )
          )
        ),
      ];
      if (neighbours.length) res.push({ [c.id]: neighbours });
    } else if (
      c.uidt === UITypes.Lookup ||
      c.uidt === UITypes.LinkToAnotherRecord
    ) {
      const neighbours = await processLookupOrLTARColumn(c);
      if (neighbours?.length) res.push({ [c.id]: neighbours });
    }
    return res;
  }, Promise.resolve([]));

  async function processLookupFormula(col: ColumnType, columns: ColumnType[]) {
    const neighbours = [];

    if (formulaCol.fk_model_id === col.fk_model_id) {
      return [col.id];
    }

    // Extract columns used in the formula and check for cycles
    const referencedColumns =
      (col.colOptions as FormulaType).formula.match(/c_?\w{14,15}/g) || [];

    for (const refColId of referencedColumns) {
      const refCol = columns.find((c) => c.id === refColId);
      if (refCol.uidt === UITypes.Formula) {
        neighbours.push(...(await processLookupFormula(refCol, columns)));
      } else if (
        refCol.uidt === UITypes.Lookup ||
        refCol.uidt === UITypes.LinkToAnotherRecord
      ) {
        neighbours.push(...(await processLookupOrLTARColumn(refCol)));
      }
    }
    return neighbours;
  }

  // Function to process lookup columns recursively
  async function processLookupOrLTARColumn(
    lookupOrLTARCol: ColumnType & {
      colOptions?: LookupType | LinkToAnotherRecordType;
    }
  ) {
    const neighbours = [];

    let ltarColumn: ColumnType;
    let lookupFilterFn: (column: ColumnType) => boolean;

    if (lookupOrLTARCol.uidt === UITypes.Lookup) {
      const relationColId = (lookupOrLTARCol.colOptions as LookupType)
        .fk_relation_column_id;
      const lookupColId = (lookupOrLTARCol.colOptions as LookupType)
        .fk_lookup_column_id;
      ltarColumn = columns.find((c) => c.id === relationColId);
      lookupFilterFn = (column: ColumnType) => column.id === lookupColId;
    } else if (lookupOrLTARCol.uidt === UITypes.LinkToAnotherRecord) {
      ltarColumn = lookupOrLTARCol;
      lookupFilterFn = (column: ColumnType) => !!column.pv;
    }

    if (ltarColumn) {
      const relatedTableMeta = await getMeta(
        (ltarColumn.colOptions as LinkToAnotherRecordType).fk_related_model_id
      );
      const lookupTarget = relatedTableMeta.columns.find(lookupFilterFn);

      if (lookupTarget) {
        if (lookupTarget.uidt === UITypes.Formula) {
          neighbours.push(
            ...(await processLookupFormula(
              lookupTarget,
              relatedTableMeta.columns
            ))
          );
        } else if (
          lookupTarget.uidt === UITypes.Lookup ||
          lookupTarget.uidt === UITypes.LinkToAnotherRecord
        ) {
          neighbours.push(...(await processLookupOrLTARColumn(lookupTarget)));
        }
      }
    }
    return [...new Set(neighbours)];
  }

  // include target formula column (i.e. the one to be saved if applicable)
  const targetFormulaCol = columns.find(
    (c: ColumnType) =>
      c.title === (parsedTree as IdentifierNode).name &&
      [UITypes.Formula, UITypes.LinkToAnotherRecord, UITypes.Lookup].includes(
        c.uidt as UITypes
      )
  );

  if (targetFormulaCol && formulaCol?.id) {
    formulaPaths.push({
      [formulaCol?.id as string]: [targetFormulaCol.id],
    });
  }
  const vertices = formulaPaths.length;
  if (vertices > 0) {
    // perform kahn's algo for cycle detection
    const adj = new Map();
    const inDegrees = new Map();
    // init adjacency list & indegree

    for (const [_, v] of Object.entries(formulaPaths)) {
      const src = Object.keys(v)[0];
      const neighbours = v[src];
      inDegrees.set(src, inDegrees.get(src) || 0);
      for (const neighbour of neighbours) {
        adj.set(src, (adj.get(src) || new Set()).add(neighbour));
        inDegrees.set(neighbour, (inDegrees.get(neighbour) || 0) + 1);
      }
    }
    const queue: string[] = [];
    // put all vertices with in-degree = 0 (i.e. no incoming edges) to queue
    inDegrees.forEach((inDegree, col) => {
      if (inDegree === 0) {
        // in-degree = 0 means we start traversing from this node
        queue.push(col);
      }
    });
    // init count of visited vertices
    let visited = 0;
    // BFS
    while (queue.length !== 0) {
      // remove a vertex from the queue
      const src = queue.shift();
      // if this node has neighbours, increase visited by 1
      const neighbours = adj.get(src) || new Set();
      if (neighbours.size > 0) {
        visited += 1;
      }
      // iterate each neighbouring nodes
      neighbours.forEach((neighbour: string) => {
        // decrease in-degree of its neighbours by 1
        inDegrees.set(neighbour, inDegrees.get(neighbour) - 1);
        // if in-degree becomes 0
        if (inDegrees.get(neighbour) === 0) {
          // then put the neighboring node to the queue
          queue.push(neighbour);
        }
      });
    }
    // vertices not same as visited = cycle found
    if (vertices !== visited) {
      throw new FormulaError(
        FormulaErrorType.CIRCULAR_REFERENCE,
        {
          key: 'msg.formula.cantSaveCircularReference',
        },
        'Circular reference detected'
      );
    }
  }
}
