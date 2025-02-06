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
  value?: any;
}
export interface FilterGroupSubType {
  is_group: true;
  logical_op: string;
  children?: FilterSubtype;
}

export type FilterSubtype = (FilterClauseSubType | FilterGroupSubType)[];

export const parseMultiClause = async (
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
        ? await parseAndOrClause(clause)
        : clause.name === 'not_clause'
        ? await parseNotClause(clause)
        : await parseParenClause(clause)
    );
  }
  return result;
};

export const parseNotClause = async (cst: CstNotClause) => {
  return parseParenClause(cst.children.clause[0], {
    logicalOperator: 'not',
  });
};

export const parseAndOrClause = async (cst: CstAndOrClause) => {
  return parseParenClause(cst.children.clause[0], {
    logicalOperator: cst.children.operator[0].image.replace('~', ''),
  });
};

export const parseParenClause = async (
  cst: CstParenClause,
  opt?: { logicalOperator?: string }
) => {
  const clause = cst.children.clause[0];
  if (clause.name === 'multi_clause') {
    return await parseMultiClause(clause, opt);
  } else {
    return await parseCallExpression(clause, opt);
  }
};
export const parseCallExpression = async (
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
  result.comparison_sub_op = cst.children.expression_arguments[0].children
    .SUBOPERATOR?.[0]?.image as any;
  if (cst.children.expression_arguments[0].children.VARIABLE) {
    result.value = parseVariable(
      cst.children.expression_arguments[0].children.VARIABLE
    );
  }

  return result;
};

export const parseCst = async (cst: CstMultiClause) => {
  return await parseMultiClause(cst);
};
