import { CstParser, TokenType } from 'chevrotain';
import { COMMON_TOKEN } from './common-token';
import { Rule, Token } from './common-type';
type ConstructorOpt = {
  enabledRules: {
    VARIABLE?: string | null;
    SGL_QUOTE_IDENTIFIER?: string | null;
    DBL_QUOTE_IDENTIFIER?: string | null;
  };
};
export type VariableRule = Rule<
  {
    IDENTIFIER?: Token[];
    SUP_SGL_QUOTE_IDENTIFIER?: Token[];
    SUP_DBL_QUOTE_IDENTIFIER?: Token[];
    EMPTY_QUOTED_IDENTIFIER?: Token[];
  },
  'VARIABLE'
>;

export type VariableRuleToken = VariableRule & {
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
};

export const getVariableRuleToken = (variable: VariableRule) => {
  const childToken =
    variable.children.SUP_SGL_QUOTE_IDENTIFIER?.[0] ??
    variable.children.SUP_DBL_QUOTE_IDENTIFIER?.[0] ??
    variable.children.IDENTIFIER?.[0];
  return {
    ...variable,
    startOffset: childToken?.startOffset,
    endOffset: childToken?.endOffset,
    startLine: childToken?.startLine,
    endLine: childToken?.endLine,
    startColumn: childToken?.startColumn,
    endColumn: childToken?.endColumn,
  };
};

export const parseVariable = (
  variable: VariableRule | VariableRule[]
): string | string[] => {
  if (Array.isArray(variable)) {
    if (variable.length === 1) {
      return parseVariable(variable[0]);
    }
    return variable.map((eachVar) => parseVariable(eachVar) as string);
  } else {
    if (
      variable.children.IDENTIFIER?.[0]?.image &&
      (variable.children.IDENTIFIER?.[0]?.image === 'NULL' ||
        variable.children.IDENTIFIER?.[0]?.image === 'null')
    ) {
      return null;
    } else if (
      variable.children.EMPTY_QUOTED_IDENTIFIER &&
      variable.children.EMPTY_QUOTED_IDENTIFIER?.[0]?.image
    ) {
      return '';
    }
    return (
      variable.children.IDENTIFIER?.[0]?.image ??
      trimQuote(variable.children.SUP_SGL_QUOTE_IDENTIFIER?.[0]?.image) ??
      trimQuote(variable.children.SUP_DBL_QUOTE_IDENTIFIER?.[0]?.image)
    );
  }
};
export const parseVariableAsArray = (
  variable: VariableRule | VariableRule[]
): string[] => {
  const result = parseVariable(variable);
  if (!Array.isArray(result)) {
    return [result];
  } else {
    return result;
  }
};

export const parseVariableAsString = (
  variable: VariableRule | VariableRule[]
) => {
  const result = parseVariable(variable);
  if (Array.isArray(result)) {
    if (result.filter((k) => k === null).length === result.length) {
      return null;
    } else {
      return result.join(' ');
    }
  } else {
    return result;
  }
};

export const trimQuote = (value?: string) => {
  if (value === undefined) {
    return value;
  }
  return value?.substring(1, value.length - 1);
};

export abstract class CommonCstParser extends CstParser {
  constructor(
    tokens: TokenType[],
    opt: ConstructorOpt = {
      enabledRules: {
        VARIABLE: 'VARIABLE',
      },
    }
  ) {
    super(tokens);
    this.prepareCommonRules(opt);
  }

  protected prepareCommonRules(opt: ConstructorOpt) {
    const $ = this;
    if (opt.enabledRules.VARIABLE) {
      $.RULE(opt.enabledRules.VARIABLE, () => {
        $.OR([
          {
            ALT: () => {
              $.CONSUME(COMMON_TOKEN.EMPTY_QUOTED_IDENTIFIER);
            },
          },
          {
            ALT: () => {
              $.CONSUME(COMMON_TOKEN.SUP_SGL_QUOTE_IDENTIFIER);
            },
          },
          {
            ALT: () => {
              $.CONSUME(COMMON_TOKEN.SUP_DBL_QUOTE_IDENTIFIER);
            },
          },
          {
            ALT: () => {
              $.CONSUME(COMMON_TOKEN.COMMA_SUPPORTED_IDENTIFIER);
            },
          },
          {
            ALT: () => {
              $.CONSUME(COMMON_TOKEN.IDENTIFIER);
            },
          },
        ]);
      });
    }
  }
}
