import {
  BINARY_LOGICAL_OPERATOR,
  NOT_OPERATOR,
  QUERY_FILTER_TOKENS,
  QueryFilterLexer,
  TOKEN_OPERATOR,
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
    $.RULE('multi_clause', () => {
      $.OR([
        { ALT: () => $.SUBRULE($['not_clause'], { LABEL: 'clause' }) },
        { ALT: () => $.SUBRULE($['paren_clause'], { LABEL: 'clause' }) },
      ]);
      $.MANY({
        DEF: () => $.SUBRULE($['and_or_clause'], { LABEL: 'clause' }),
      });
    });
    $.RULE('and_or_clause', () => {
      $.CONSUME(BINARY_LOGICAL_OPERATOR, { LABEL: 'operator' });
      $.SUBRULE($['paren_clause'], { LABEL: 'clause' });
    });
    $.RULE('not_clause', () => {
      $.CONSUME(NOT_OPERATOR);
      $.SUBRULE($['paren_clause'], { LABEL: 'clause' });
    });
    $.RULE('paren_clause', () => {
      $.CONSUME(COMMON_TOKEN.PAREN_START);
      $.OR([
        { ALT: () => $.SUBRULE($['call_expression'], { LABEL: 'clause' }) },
        { ALT: () => $.SUBRULE($['multi_clause'], { LABEL: 'clause' }) },
      ]);
      $.CONSUME(COMMON_TOKEN.PAREN_END);
    });
    $.RULE('call_expression', () => {
      $.SUBRULE($['VARIABLE']);
      $.CONSUME2(COMMON_TOKEN.COMMA);
      $.CONSUME(TOKEN_OPERATOR);
      $.OPTION(() => {
        $.CONSUME3(COMMON_TOKEN.COMMA);
        // even after comma, the expression arguments can be blank
        $.OPTION2(() => {
          $.SUBRULE($['expression_arguments']);
        });
      });
    });
    $.RULE('expression_arguments', () => {
      $.MANY_SEP({
        SEP: COMMON_TOKEN.COMMA,
        DEF: () => {
          $.SUBRULE2($['VARIABLE']);
        },
      });
    });
  }

  parse() {
    return (this as any).multi_clause();
  }

  static parse(text: string) {
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
        parser.errors && parser.errors.length === 0 ? parseCst(cst) : undefined,
    };
  }
}
