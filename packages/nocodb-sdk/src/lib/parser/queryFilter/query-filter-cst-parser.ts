import type { Rule, Token } from '../common-type';
import {
  parseVariableAsArray,
  parseVariableAsString,
  VariableRule,
} from '../common-cst-parser';
import { NcSDKError } from '~/lib/errorUtils';
import { COMPARISON_SUB_OPS } from './query-filter-lexer';

export interface CstExpressionArguments
  extends Rule<
    {
      VARIABLE: VariableRule[];
      SUBOPERATOR: Token[];
    },
    'expression_arguments'
  > {}

export interface CstMultiClause
  extends Rule<
    {
      clause: (CstAndOrClause | CstNotClause | CstParenClause)[];
    },
    'multi_clause'
  > {}
export interface CstAndOrClause
  extends Rule<
    {
      clause: CstParenClause[];
      operator: Token[];
    },
    'and_or_clause'
  > {}
export interface CstNotClause
  extends Rule<
    {
      clause: CstParenClause[];
    },
    'not_clause'
  > {}
export interface CstParenClause
  extends Rule<
    {
      clause: (CstMultiClause | CstCallExpression)[];
      PAREN_START: Token[];
      PAREN_END: Token[];
    },
    'paren_clause'
  > {}

export interface CstCallExpression
  extends Rule<
    {
      PAREN_START: Token[];
      VARIABLE: VariableRule[];
      COMMA: Token[];
      OPERATOR: Token[];
      expression_arguments: CstExpressionArguments[];
      PAREN_END: Token[];
    },
    'call_expression'
  > {}

export interface FilterClauseSubType {
  is_group: false;
  field: string;
  logical_op?: string;
  comparison_op: string;
  comparison_sub_op?: string;
  value?: string | string[];
}
export interface FilterGroupSubType {
  is_group: true;
  logical_op: string;
  children?: FilterSubtype;
}

export type FilterSubtype = (FilterClauseSubType | FilterGroupSubType)[];

export const parseMultiClause = (
  cst: CstMultiClause,
  opt?: { logicalOperator?: string }
) => {
  const result: FilterGroupSubType = {
    is_group: true,
    logical_op: opt?.logicalOperator ?? 'and',
    children: [],
  };
  for (let index = 0; index < cst.children.clause.length; index++) {
    const clause = cst.children.clause[index];
    result.children.push(
      clause.name === 'and_or_clause'
        ? parseAndOrClause(clause)
        : clause.name === 'not_clause'
        ? parseNotClause(clause)
        : parseParenClause(clause)
    );
  }
  return result;
};

export const parseNotClause = (cst: CstNotClause) => {
  return parseParenClause(cst.children.clause[0], {
    logicalOperator: 'not',
  });
};

export const parseAndOrClause = (cst: CstAndOrClause) => {
  return parseParenClause(cst.children.clause[0], {
    logicalOperator: cst.children.operator[0].image.replace('~', ''),
  });
};

export const parseParenClause = (
  cst: CstParenClause,
  opt?: { logicalOperator?: string }
) => {
  const clause = cst.children.clause[0];
  if (clause.name === 'multi_clause') {
    return parseMultiClause(clause, opt);
  } else {
    return parseCallExpression(clause, opt);
  }
};
export const parseCallExpression = (
  cst: CstCallExpression,
  opt?: { logicalOperator?: string }
) => {
  const operator = cst.children.OPERATOR[0].image;

  const result: FilterClauseSubType = {
    is_group: false,
    field: parseVariableAsString(cst.children.VARIABLE),
    comparison_op: operator as any,
    logical_op: opt?.logicalOperator,
  };
  if (
    cst.children.expression_arguments &&
    cst.children.expression_arguments[0].children.VARIABLE
  ) {
    const variables = parseVariableAsArray(
      cst.children.expression_arguments[0].children.VARIABLE
    );
    result.comparison_sub_op = COMPARISON_SUB_OPS.includes(variables[0] as any)
      ? variables[0]
      : undefined;
    // if identified as sub op, pop first variable
    if (result.comparison_sub_op) {
      variables.shift();
    }
    // keep variable as comma separated string if not in operator
    result.value = operator === 'in' ? variables : variables.join(',');
  }
  handleBlankOperator(result);
  handleInOperator(result);
  handleOperatorAndValue(result);
  return result;
};

const handleBlankOperator = (filter: FilterClauseSubType) => {
  switch (filter.comparison_op) {
    case 'is':
      if (filter.value === 'blank') {
        filter.comparison_op = 'blank';
        filter.value = undefined;
      } else if (filter.value === 'notblank') {
        filter.comparison_op = 'notblank';
        filter.value = undefined;
      }
      break;
    case 'isblank':
    case 'is_blank':
      filter.comparison_op = 'blank';
      break;
    case 'isnotblank':
    case 'is_not_blank':
    case 'is_notblank':
      filter.comparison_op = 'notblank';
      break;
  }
};

const handleInOperator = (filter: FilterClauseSubType) => {
  if (filter.comparison_op === 'in' && !Array.isArray(filter.value)) {
    filter.value = (filter.value as string)?.split(',');
  }
};

const handleOperatorAndValue = (filter: FilterClauseSubType) => {
  if (
    Array.isArray(filter.value) &&
    [
      'eq',
      'neq',
      'not',
      'like',
      'nlike',
      'empty',
      'notempty',
      'null',
      'notnull',
      'checked',
      'notchecked',
      'blank',
      'notblank',
      'allof',
      'anyof',
      'nallof',
      'nanyof',
      'gt',
      'lt',
      'gte',
      'lte',
      'ge',
      'le',
      'isnot',
      'is',
    ].includes(filter.comparison_op)
  ) {
    throw new NcSDKError('Value not valid for selected operator');
  } else if (
    Array.isArray(filter.value) &&
    ['gb_eq'].includes(filter.comparison_op)
  ) {
    filter.value = filter.value.join(',');
  } // for equality, replace with empty string if value is undefined
  else if (
    filter.value === undefined &&
    ['eq', 'neq', 'gb_eq'].includes(filter.comparison_op)
  ) {
    filter.value = '';
  }
};

export const parseCst = (cst: CstMultiClause) => {
  return parseMultiClause(cst);
};
