import { createToken, Lexer } from 'chevrotain';
import { COMMON_TOKEN } from '../common-token';

export const TOKEN_OPERATOR = createToken({
  name: 'OPERATOR',
  pattern:
    /\b(eq|neq|not|like|nlike|empty|notempty|null|notnull|checked|notchecked|blank|notblank|allof|anyof|nallof|nanyof|gt|lt|gte|lte|ge|le|in|isnot|is|isWithin|btw|nbtw)\b/,
  longer_alt: COMMON_TOKEN.IDENTIFIER,
});
export const TOKEN_SUBOPERATOR = createToken({
  name: 'SUBOPERATOR',
  pattern:
    /\b(today|tomorrow|yesterday|oneWeekAgo|oneWeekFromNow|oneMonthAgo|oneMonthFromNow|daysAgo|daysFromNow|exactDate|pastWeek|pastMonth|pastYear|nextWeek|nextMonth|nextYear|pastNumberOfDays|nextNumberOfDays)\b/,
  longer_alt: COMMON_TOKEN.IDENTIFIER,
});

export const BINARY_LOGICAL_OPERATOR = createToken({
  name: 'BINARY_LOGICAL_OPERATOR',
  pattern: /~or|~and/,
});
export const NOT_OPERATOR = createToken({
  name: 'NOT_OPERATOR',
  pattern: /~not/,
  longer_alt: COMMON_TOKEN.IDENTIFIER,
});

export const QUERY_FILTER_TOKENS = [
  COMMON_TOKEN.WHITESPACE_SKIP,
  TOKEN_OPERATOR,
  TOKEN_SUBOPERATOR,
  BINARY_LOGICAL_OPERATOR,
  NOT_OPERATOR,
  COMMON_TOKEN.PAREN_START,
  COMMON_TOKEN.PAREN_END,
  COMMON_TOKEN.COMMA,
  COMMON_TOKEN.SUP_SGL_QUOTE_IDENTIFIER,
  COMMON_TOKEN.SUP_DBL_QUOTE_IDENTIFIER,
  COMMON_TOKEN.IDENTIFIER,
];

export const QueryFilterLexer = new Lexer(QUERY_FILTER_TOKENS);
