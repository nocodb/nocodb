import {
  QUERY_FILTER_TOKENS,
  QueryFilterLexer,
  TOKEN_OPERATOR,
  TOKEN_SUBOPERATOR,
} from './query-filter-lexer';
import { COMMON_TOKEN } from '../common-token';
import { CommonCstParser } from '../common-cst-parser';
import { parseCst } from './query-filter-cst-parser';

export class QueryFilterParser extends CommonCstParser {
  constructor() {
    super(QUERY_FILTER_TOKENS);
    this.initializeRule();

    // very important to call this after all the rules have been defined.
    // otherwise the parser may not work correctly as it will lack information
    // derived during the self analysis phase.
    this.performSelfAnalysis();
  }
  private initializeRule() {
    // not mandatory, using $ (or any other sign) to reduce verbosity (this. this. this. this. .......)
    const $ = this;

    // the parsing methods
    // we define the "rules" of how the syntax will be defined
    $.RULE('call_expression', () => {
      $.CONSUME(COMMON_TOKEN.PAREN_START);
      $.CONSUME(COMMON_TOKEN.IDENTIFIER);
      $.CONSUME2(COMMON_TOKEN.COMMA);
      $.CONSUME(TOKEN_OPERATOR);
      $.CONSUME3(COMMON_TOKEN.COMMA);
      $.SUBRULE(($ as any).expression_arguments);
      $.CONSUME(COMMON_TOKEN.PAREN_END);
    });
    $.RULE('expression_arguments', () => {
      $.OR([
        { ALT: () => $.CONSUME(TOKEN_SUBOPERATOR) },
        {
          ALT: () => {
            $.SUBRULE($['VARIABLE']);
          },
        },
      ]);
      $.OPTION(() => $.CONSUME(COMMON_TOKEN.COMMA));

      $.MANY_SEP({
        SEP: COMMON_TOKEN.COMMA,
        DEF: () => {
          $.SUBRULE2($['VARIABLE']);
        },
      });
    });
  }

  parse() {
    return (this as any).call_expression();
  }

  static async parse(text: string) {
    const parser = new QueryFilterParser();
    const lexResult = QueryFilterLexer.tokenize(text);
    // setting a new input will RESET the parser instance's state.
    parser.input = lexResult.tokens;
    // any top level rule may be used as an entry point
    const cst = parser.parse();

    return {
      cst: cst,
      lexErrors: lexResult.errors,
      parseErrors: parser.errors,
      parsedCst:
        parser.errors && parser.errors.length === 0
          ? await parseCst(cst)
          : undefined,
    };
  }
}
