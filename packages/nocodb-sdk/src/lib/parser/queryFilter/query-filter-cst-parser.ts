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
export interface CstParenClause
  extends Rule<
    {
      NOT_OPERATOR: Token[];
      clause: (CstMultiClause | CstCallExpression)[];
      PAREN_START: Token[];
      PAREN_END: Token[];
    },
    'paren_clause'
  > {}

export interface CstMultiClause
  extends Rule<
    {
      clause: CstParenClause[];
      BINARY_LOGICAL_OPERATOR: Token[];
    },
    'multi_clause'
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
    const logicalOpNode =
      index > 0 ? cst.children.BINARY_LOGICAL_OPERATOR[index - 1] : undefined;
    result.children.push(
      await parseParenClause(clause, {
        logicalOperator: logicalOpNode
          ? logicalOpNode.image.replace('~', '')
          : undefined,
      })
    );
  }
  return result;
};
export const parseParenClause = async (
  cst: CstParenClause,
  opt?: { logicalOperator?: string }
) => {
  const isNot: boolean =
    cst.children.NOT_OPERATOR !== undefined &&
    cst.children.NOT_OPERATOR.length > 0;
  const clause = cst.children.clause[0];
  if (clause.name === 'multi_clause') {
    return await parseMultiClause(clause, opt);
  } else {
    return await parseCallExpression(clause, {
      logicalOperator: isNot ? 'not' : opt.logicalOperator,
    });
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
    logical_op: opt.logicalOperator,
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
