export const REGEXSTR_ALPHABET = <const>'A-Za-z';
export const REGEXSTR_WHITESPACE = <const>' ';
export const REGEXSTR_CHINESE = <const>'一-龠';
export const REGEXSTR_MANDARIN = REGEXSTR_CHINESE;
export const REGEXSTR_HIRA_KATA_KANA = <const>'ぁ-ゔァ-ヴー々〆〤ヶ';
export const REGEXSTR_JAPANESE = REGEXSTR_HIRA_KATA_KANA;
export const REGEXSTR_CYRILLIC = <const>'\u0400-\u04FF';
export const REGEXSTR_HANGUL = <const>(
  '\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF\uD7B0-\uD7FF'
);
export const REGEXSTR_KOREAN = REGEXSTR_HANGUL;
export const REGEXSTR_ARABIC = <const>'\u0621-\u064A';
export const REGEXSTR_DEVANAGARI = <const>'\u0900-\u097F';
export const REGEXSTR_GREEK = <const>'\u0370-\u03FF';
export const REGEXSTR_HEBREW = <const>'\u0590-\u05FF';
export const REGEXSTR_THAI = <const>'\u0E00-\u0E7F';
export const REGEXSTR_TAMIL = <const>'\u0B80-\u0BFF';
export const REGEXSTR_ARMENIAN = <const>'\u0530-\u058F';
export const REGEXSTR_BENGALI = <const>'\u0980-\u09FF';
export const REGEXSTR_GEORGIAN = <const>'\u10A0-\u10FF';
export const REGEXSTR_GUJARATI = <const>'\u0A80-\u0AFF';
export const REGEXSTR_KANNADA = <const>'\u0C80-\u0CFF';
export const REGEXSTR_KHMER = <const>'\u1780-\u17FF';
export const REGEXSTR_MALAYALAM = <const>'\u0D00-\u0D7F';
export const REGEXSTR_MONGOLIAN = <const>'\u1800-\u18AF';
export const REGEXSTR_MYANMAR = <const>'\u1000-\u109F';
export const REGEXSTR_SINHALA = <const>'\u0D80-\u0DFF';
export const REGEXSTR_SYRIAC = <const>'\u0700-\u074F';
// alphabet is ommitted to prevent duplicates
export const REGEXSTR_VIETNAMESE = <const>'\u0300-\u036F'; // Latin characters with diacritics

export const REGEXSTR_INTL_LETTER = [
  REGEXSTR_ALPHABET,
  REGEXSTR_CHINESE,
  REGEXSTR_CYRILLIC,
  REGEXSTR_HIRA_KATA_KANA,
  REGEXSTR_KOREAN,
  REGEXSTR_ARABIC,
  REGEXSTR_DEVANAGARI,
  REGEXSTR_GREEK,
  REGEXSTR_HEBREW,
  REGEXSTR_THAI,
  REGEXSTR_TAMIL,
  REGEXSTR_ARMENIAN,
  REGEXSTR_BENGALI,
  REGEXSTR_GEORGIAN,
  REGEXSTR_GUJARATI,
  REGEXSTR_KANNADA,
  REGEXSTR_KHMER,
  REGEXSTR_MALAYALAM,
  REGEXSTR_MONGOLIAN,
  REGEXSTR_MYANMAR,
  REGEXSTR_SINHALA,
  REGEXSTR_SYRIAC,
  REGEXSTR_VIETNAMESE,
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
  '`"(),` ',
].join('');
export const REGEXSTR_DBL_QUOTED_IDENTIFIER_SPECIAL_CHAR = [
  REGEXSTR_IDENTIFIER_SPECIAL_CHAR,
  "`'(), ",
].join('');
export const REGEXSTR_BACK_QUOTED_IDENTIFIER_SPECIAL_CHAR = [
  REGEXSTR_IDENTIFIER_SPECIAL_CHAR,
  `'"(), `,
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
