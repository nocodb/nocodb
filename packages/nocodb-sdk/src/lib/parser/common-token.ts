import { createToken, Lexer } from 'chevrotain';
import {
  REGEXSTR_IDENTIFIER_SPECIAL_CHAR,
  REGEXSTR_INTL_LETTER,
  REGEXSTR_NUMERIC_ARABIC,
  REGEXSTR_WHITESPACE,
} from '../regex';
const IDENTIFIER = createToken({
  name: 'IDENTIFIER',
  pattern: new RegExp(
    `[${REGEXSTR_INTL_LETTER}${REGEXSTR_NUMERIC_ARABIC}${REGEXSTR_IDENTIFIER_SPECIAL_CHAR}${REGEXSTR_WHITESPACE}]+`
  ),
});
export const COMMON_TOKEN = {
  PAREN_START: createToken({ name: 'PAREN_START', pattern: /\(/ }),
  PAREN_END: createToken({ name: 'PAREN_END', pattern: /\)/ }),
  SQ_BRACKET_START: createToken({ name: 'SQ_BRACKET_START', pattern: /\[/ }),
  SQ_BRACKET_END: createToken({ name: 'SQ_BRACKET_END', pattern: /\]/ }),
  CURLY_START: createToken({ name: 'CURLY_START', pattern: /\{/ }),
  CURLY_END: createToken({ name: 'CURLY_END', pattern: /\}/ }),
  NUMBER_LITERAL: createToken({ name: 'NUMBER_LITERAL', pattern: /[1-9]\d*/ }),
  ALPHABET_LITERAL: createToken({
    name: 'ALPHABET_LITERAL',
    pattern: /[a-zA-Z]\d*/,
  }),
  COMMA: createToken({ name: 'COMMA', pattern: /,/ }),
  WHITESPACE: createToken({
    name: 'WHITESPACE',
    // do not delete the space inside aregex
    pattern: /[ \t\n\r]+/,
  }),
  WHITESPACE_SKIP: createToken({
    name: 'WHITESPACE',
    // do not delete the space inside aregex
    pattern: /[ \t\n\r]+/,
    group: Lexer.SKIPPED,
  }),
  PLUS: createToken({ name: 'PLUS', pattern: /\+/ }),
  MINUS: createToken({ name: 'MINUS', pattern: /-/ }),
  MULTI: createToken({ name: 'MULTI', pattern: /\*/ }),
  DIVIDE: createToken({ name: 'DIVIDE', pattern: /\// }),
  COLON: createToken({ name: 'COLON', pattern: /:/ }),
  SEMICOLON: createToken({ name: 'SEMICOLON', pattern: /;/ }),
  PIPE: createToken({ name: 'PIPE', pattern: /|/ }),
  SLASH: createToken({ name: 'SLASH', pattern: /\// }),
  BACKSLASH: createToken({ name: 'BACKSLASH', pattern: /\\/ }),
  DBL_QUOTE: createToken({ name: 'DBL_QUOTE', pattern: /"/ }),
  SGL_QUOTE: createToken({ name: 'SGL_QUOTE', pattern: /'/ }),
  IDENTIFIER: IDENTIFIER,
  SUP_SGL_QUOTE_IDENTIFIER: createToken({
    name: 'SUP_SGL_QUOTE_IDENTIFIER',
    pattern: /'((?:\\'|[^'])+)'/,
    longer_alt: IDENTIFIER,
  }),
  SUP_DBL_QUOTE_IDENTIFIER: createToken({
    name: 'SUP_DBL_QUOTE_IDENTIFIER',
    pattern: /"((?:\\"|[^"])+)"/,
    longer_alt: IDENTIFIER,
  }),
  SUP_BACK_QUOTE_IDENTIFIER: createToken({
    name: 'SUP_BACK_QUOTE_IDENTIFIER',
    pattern: /`((?:\\`|[^`])+)`/,
    longer_alt: IDENTIFIER,
  }),
};
