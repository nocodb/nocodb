import osLocale from 'os-locale';
import english from './english.json';
import translated from './translated.json';

/* Converted from : https://smodin.me/translate-one-text-into-multiple-languages
 * Enter database host name || Choose SQL Database type || Enter database username || Enter database password || Enter database port number || Enter database/schema name || Enter API type to generate || How do you want to run it
 * */

const formattedTranslate: any = {};
for (const { symbol, text } of [english, ...translated].sort((a: any, b: any) =>
  a.symbol.localeCompare(b.symbol),
) as any[]) {
  formattedTranslate[symbol] = text.split(/\s*\|\|\s*/);
}

const dummy: any = new Date();
const offset: any = -dummy.getTimezoneOffset();
// @ts-ignore
const locale: string = offset === 330 ? 'en-IN' : osLocale.sync();

enum STR {
  SLOGAN,
}

class Lang {
  // @ts-ignore
  public static getString(str: STR): string {
    switch (locale) {
      case 'en':
      case 'en-GB':
      case 'en-AU':
      case 'en-CA':
      case 'en-IE':
      case 'en-US':
      default:
        return `${formattedTranslate?.en?.[str]}`;
      case 'zh':
      case 'zh-Hans':
      case 'zh-Hant':
      case 'zh-CN':
        return `${formattedTranslate?.['zh-cn']?.[str]}`;

      case 'zh-HK':
      case 'zh-TW':
        return `${formattedTranslate?.['zh-tw']?.[str]}`;

      // case 'en-IN':
      //   break;

      case 'de':
      case 'de-DE':
      case 'de-CH':
      case 'de-AT':
        return `${formattedTranslate?.de?.[str]}`;
      case 'el':
      case 'el-GR':
        return `${formattedTranslate?.el?.[str]}`;

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
        return `${formattedTranslate?.es?.[str]}`;
      case 'fi':
      case 'fi-FI':
        return `${formattedTranslate?.fi?.[str]}`;

      case 'fr':
      case 'fr-CA':
      case 'fr-FR':
      case 'fr-BE':
      case 'fr-CH':
        return `${formattedTranslate?.fr?.[str]}`;
      case 'it':
      case 'it-IT':
        return `${formattedTranslate?.it?.[str]}`;

      case 'ja':
      case 'ja-JP':
        return `${formattedTranslate?.ja?.[str]}`;
      case 'ko':
      case 'ko-KR':
        return `${formattedTranslate?.ko?.[str]}`;

      case 'nl':
      case 'nl-BE':
      case 'nl-NL':
      case 'nn-NO':
        return `${formattedTranslate?.nl?.[str]}`;

      case 'pt':
      case 'pt-BR':
      case 'pt-PT':
        return `${formattedTranslate?.pt?.[str]}`;

      case 'ru':
      case 'ru-RU':
        return `${formattedTranslate?.ru?.[str]}`;

      case 'sv':
      case 'sv-SE':
        return `${formattedTranslate?.sv?.[str]}`;

      case 'th':
      case 'th-TH':
        return `${formattedTranslate?.th?.[str]}`;

      case 'tl':
      case 'tl-PH':
        return `${formattedTranslate?.tl?.[str]}`;

      case 'tr':
      case 'tr-TR':
        return `${formattedTranslate?.tr?.[str]}`;

      case 'uk':
      case 'uk-UA':
        return `${formattedTranslate?.uk?.[str]}`;

      case 'vi':
      case 'vi-VN':
        return `${formattedTranslate?.vi?.[str]}`;
    }
  }
}

export default Lang;
export { STR };
