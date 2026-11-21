import { createToken, Lexer } from 'chevrotain';
import { COMMON_TOKEN } from '../common-token';
import {
  COMPARISON_OPS,
  COMPARISON_OPS_ALIAS,
  GROUPBY_COMPARISON_OPS,
} from './query-filter-ops';

export {
  COMPARISON_OPS,
  COMPARISON_OPS_ALIAS,
  COMPARISON_SUB_OPS,
  DAY_COUNT_COMPARISON_SUB_OPS,
  GROUPBY_COMPARISON_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from './query-filter-ops';

export const TOKEN_OPERATOR = createToken({
  name: 'OPERATOR',
  pattern: new RegExp(
    `\\b(${[
      ...COMPARISON_OPS,
      ...COMPARISON_OPS_ALIAS,
      ...GROUPBY_COMPARISON_OPS,
    ].join('|')})\\b`
  ),
  longer_alt: COMMON_TOKEN.IDENTIFIER,
  categories: [COMMON_TOKEN.IDENTIFIER],
});
export const NOT_OPERATOR = createToken({
  name: 'NOT_OPERATOR',
  pattern: /~not/,
  longer_alt: COMMON_TOKEN.IDENTIFIER,
  categories: [COMMON_TOKEN.IDENTIFIER],
});

export const QUERY_FILTER_TOKENS = [
  COMMON_TOKEN.WHITESPACE_SKIP,
  TOKEN_OPERATOR,
  NOT_OPERATOR,
  COMMON_TOKEN.PAREN_START,
  COMMON_TOKEN.PAREN_END,
  COMMON_TOKEN.COMMA,
  COMMON_TOKEN.EMPTY_QUOTED_IDENTIFIER,
  COMMON_TOKEN.SUP_SGL_QUOTE_IDENTIFIER,
  COMMON_TOKEN.SUP_DBL_QUOTE_IDENTIFIER,
  COMMON_TOKEN.IDENTIFIER,
];

export const QueryFilterLexer = new Lexer(QUERY_FILTER_TOKENS);
