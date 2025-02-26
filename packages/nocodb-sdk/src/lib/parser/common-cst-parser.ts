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
  },
  'VARIABLE'
>;

export const parseVariable = (
  variable: VariableRule | VariableRule[]
): string | string[] => {
  if (Array.isArray(variable)) {
    if (variable.length === 1) {
      return parseVariable(variable[0]);
    }
    return variable.map((eachVar) => parseVariable(eachVar) as string);
  } else {
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
    return result.join(' ');
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
              $.CONSUME(COMMON_TOKEN.IDENTIFIER);
            },
          },
        ]);
      });
    }
  }
}
