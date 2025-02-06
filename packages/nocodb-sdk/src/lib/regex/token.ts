export const REGEXSTR_ALPHABET = <const>'A-Za-z';
export const REGEXSTR_WHITESPACE = <const>' ';
export const REGEXSTR_CHINESE = <const>'一-龠';
export const REGEXSTR_MANDARIN = REGEXSTR_CHINESE;
export const REGEXSTR_HIRA_KATA_KANA = <const>'ぁ-ゔァ-ヴー々〆〤ヶ';
export const REGEXSTR_JAPANESE = REGEXSTR_HIRA_KATA_KANA;
export const REGEXSTR_CYRILLIC = <const>'\u0400-\u04FF';
export const REGEXSTR_INTL_LETTER = [
  REGEXSTR_ALPHABET,
  REGEXSTR_CHINESE,
  REGEXSTR_CYRILLIC,
  REGEXSTR_HIRA_KATA_KANA,
].join('');
export const REGEXSTR_NUMERIC_ARABIC = <const>'0-9';
export const REGEXSTR_IDENTIFIER_SPECIAL_CHAR = <const>(
  '!@#$%^&*_+\\-=[\\]{};:\\\\|.<>/?'
);
export const REGEXSTR_IDENTIFIER = [
  REGEXSTR_INTL_LETTER,
  REGEXSTR_NUMERIC_ARABIC,
  REGEXSTR_IDENTIFIER_SPECIAL_CHAR,
].join('');
export const REGEXSTR_SGL_QUOTED_IDENTIFIER_SPECIAL_CHAR = [
  REGEXSTR_IDENTIFIER_SPECIAL_CHAR,
  '"(), ',
].join('');
export const REGEXSTR_DBL_QUOTED_IDENTIFIER_SPECIAL_CHAR = [
  REGEXSTR_IDENTIFIER_SPECIAL_CHAR,
  "'(), ",
].join('');
export const REGEXP_ALPHABET = new RegExp(`[${REGEXSTR_ALPHABET}]*`);
export const REGEXP_CHINESE = new RegExp(`[${REGEXSTR_CHINESE}]*`);
export const REGEXP_MANDARIN = REGEXP_CHINESE;
export const REGEXP_HIRA_KATA_KANA = new RegExp(
  `[${REGEXSTR_HIRA_KATA_KANA}]*`
);
export const REGEXP_JAPANESE = REGEXP_HIRA_KATA_KANA;
export const REGEXP_INTL_LETTER = new RegExp(`[${REGEXSTR_INTL_LETTER}]*`);
export const REGEXP_NUMBER_VALUE = /^[+-]?((\d+(\.\d*)?)|(\.\d+))$/;
