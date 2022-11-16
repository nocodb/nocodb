import osLocale from 'os-locale';
import english from './english.json';
import translated from './translated.json';

/* Converted from : https://smodin.me/translate-one-text-into-multiple-languages
 * Enter database host name || Choose SQL Database type || Enter database username || Enter database password || Enter database port number || Enter database/schema name || Enter API type to generate || How do you want to run it
 * */

const formattedTranslate: any = {};
for (const { symbol, text } of [english, ...translated].sort((a, b) =>
  a.symbol.localeCompare(b.symbol)
)) {
  formattedTranslate[symbol] = text.split(/\s*\|\|\s*/);
}

const dummy: any = new Date();
const offset: any = -dummy.getTimezoneOffset();
const locale: string = offset === 330 ? 'en-IN' : osLocale.sync();

const SMILEY_PREFIX = ['👉', '🔥', '👉', '🙈', '👉', '👉', '🚀', '🚀'];

enum STR {
  DB_HOST,
  DB_TYPE,
  DB_USER,
  DB_PASSWORD,
  DB_PORT,
  DB_SCHEMA,
  DB_API,
  PROJECT_TYPE
}

class Lang {
  // @ts-ignore
  public static getString(str: STR) {
    switch (locale) {
      case 'en':
      case 'en-GB':
      case 'en-AU':
      case 'en-CA':
      case 'en-IE':
      case 'en-US':
      default:
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.en?.[str]}\t:`;

      case 'zh':
      case 'zh-Hans':
      case 'zh-CN':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.['zh-cn']?.[str]}\t:`;

      case 'zh-Hant':
      case 'zh-HK':
      case 'zh-TW':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.['zh-tw']?.[str]}\t:`;

      case 'de':
      case 'de-DE':
      case 'de-CH':
      case 'de-AT':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.de?.[str]}\t:`;
      case 'el':
      case 'el-GR':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.el?.[str]}\t:`;

      case 'es':
      case 'es-AR':
      case 'es-419':
      case 'es-CL':
      case 'es-CO':
      case 'es-EC':
      case 'es-ES':
      case 'es-LA':
      case 'es-NI':
      case 'es-MX':
      case 'es-US':
      case 'es-VE':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.es?.[str]}\t:`;

      case 'fi':
      case 'fi-FI':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.fi?.[str]}\t:`;

      case 'fr':
      case 'fr-CA':
      case 'fr-FR':
      case 'fr-BE':
      case 'fr-CH':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.fr?.[str]}\t:`;

      case 'it':
      case 'it-IT':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.it?.[str]}\t:`;

      case 'ja':
      case 'ja-JP':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.ja?.[str]}\t:`;

      case 'ko':
      case 'ko-KR':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.ko?.[str]}\t:`;

      case 'nl':
      case 'nl-BE':
      case 'nl-NL':
      case 'nn-NO':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.nl?.[str]}\t:`;

      case 'pt':
      case 'pt-BR':
      case 'pt-PT':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.pt?.[str]}\t:`;

      case 'ru':
      case 'ru-RU':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.ru?.[str]}\t:`;

      case 'sv':
      case 'sv-SE':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.sv?.[str]}\t:`;

      case 'th':
      case 'th-TH':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.th?.[str]}\t:`;

      case 'tl':
      case 'tl-PH':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.tl?.[str]}\t:`;

      case 'tr':
      case 'tr-TR':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.tr?.[str]}\t:`;

      case 'uk':
      case 'uk-UA':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.uk?.[str]}\t:`;

      case 'vi':
      case 'vi-VN':
        return `${SMILEY_PREFIX[str]} ${formattedTranslate?.vi?.[str]}\t:`;
    }
  }
}

export default Lang;
export { STR };
