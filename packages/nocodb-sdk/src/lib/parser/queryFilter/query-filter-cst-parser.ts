import type { Rule, Token } from '../common-type';
import { parseVariable, VariableRule } from '../common-cst-parser';

export interface CstExpressionArguments
  extends Rule<{
    VARIABLE: VariableRule[];
    SUBOPERATOR: Token[];
  }> {}

export interface CstCallExpression
  extends Rule<{
    PAREN_START: Token[];
    IDENTIFIER: Token[];
    COMMA: Token[];
    OPERATOR: Token[];
    expression_arguments: CstExpressionArguments[];
    PAREN_END: Token[];
  }> {}

export interface FilterSubtype {
  field: string;
  comparison_op: string;
  comparison_sub_op?: string;
  value?: any;
}

export const parseCst = async (cst: CstCallExpression) => {
  const operator = cst.children.OPERATOR[0].image;

  const result: FilterSubtype = {
    field: cst.children.IDENTIFIER[0].image,
    comparison_op: operator as any,
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
