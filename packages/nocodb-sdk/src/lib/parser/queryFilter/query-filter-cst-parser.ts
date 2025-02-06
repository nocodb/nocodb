import type { Rule, Token } from '../common-type';
import { parseVariable, VariableRule } from '../common-cst-parser';

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
      IDENTIFIER: Token[];
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
    field: cst.children.IDENTIFIER[0].image,
    comparison_op: operator as any,
    logical_op: opt?.logicalOperator,
  };
  if (cst.children.expression_arguments) {
    result.comparison_sub_op = cst.children.expression_arguments[0].children
      .SUBOPERATOR?.[0]?.image as any;
    if (cst.children.expression_arguments[0].children.VARIABLE) {
      result.value = parseVariable(
        cst.children.expression_arguments[0].children.VARIABLE
      );
    }
  }
  handleBlankOperator(result);
  handleInOperator(result);
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

export const parseCst = (cst: CstMultiClause) => {
  return parseMultiClause(cst);
};
