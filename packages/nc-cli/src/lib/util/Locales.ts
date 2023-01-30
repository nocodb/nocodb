import osLocale from 'os-locale';

class Locales {
  public static getPrompt() {
    const x = new Date();
    const offset = -x.getTimezoneOffset();

    let prompt = {};

    const locale = offset === 330 ? 'en-IN' : osLocale.sync();
    switch (locale) {
      case 'en':
      case 'en-GB':
      case 'en-AU':
      case 'en-CA':
      case 'en-IE':
      case 'en-US':
      default:
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Reddit',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'English',
          message: '\n\n👋 Hello! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'zh':
      case 'zh-Hans':
      case 'zh-Hant':
      case 'zh-CN':
      case 'zh-HK':
      case 'zh-SG':
      case 'zh-TW':
        prompt = {
          choices: [
            'WeChat',
            'Github - ⭐️ or 👀 repo',
            '豆瓣', // douban
            '新浪微博', // weibo
            'Renren',
            'Line',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Chinese',
          message: '\n\n👋 你好! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'en-IN':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'WhatsApp',
            'Linkedin',
            'Facebook',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'English (India)',
          message: '\n\n👋 Hello / नमस्ते / ನ ಮ ಸ್ಕಾ ರ / ന മ സ് കാ രം / வணக்கம்! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'de':
      case 'de-DE':
      case 'de-CH':
      case 'de-AT':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'German',
          message: '\n\n👋 Hallo! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'el':
      case 'el-GR':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Greek',
          message: '\n\n👋 Γειά σου! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

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
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Spanish',
          message: '\n\n👋 Hola! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'fa':
      case 'fa-IR':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Persian',
          message: '\n\n👋 سلام! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'fi':
      case 'fi-FI':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Finnish',
          message: '\n\n👋 سلام! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'fr':
      case 'fr-CA':
      case 'fr-FR':
      case 'fr-BE':
      case 'fr-CH':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'French',
          message: '\n\n👋 Bonjour! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'ga':
      case 'ga-IE':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Irish',
          message: '\n\n👋 Dia dhuit! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'he':
      case 'he-IL':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Hebrew',
          message: '\n\n👋 שלום! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'it':
      case 'it-IT':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Italian',
          message: '\n\n👋 Ciao! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'ja':
      case 'ja-JP':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Line',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'WeChat',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Japanese',
          message: '\n\n👋 こんにちは! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'ko':
      case 'ko-KR':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Line',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'WeChat',
            '豆瓣', // douban
            '新浪微博', // weibo
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Korean',
          message: '\n\n👋 여보세요! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'mn-MN':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Mongolian',
          message: '\n\n👋 Сайн уу! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'nl':
      case 'nl-BE':
      case 'nl-NL':
      case 'nn-NO':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Dutch',
          message: '\n\n👋 Hallo! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'pt':
      case 'pt-BR':
      case 'pt-PT':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Portuguese',
          message: '\n\n👋 Olá! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'ru':
      case 'ru-RU':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'OKru',
            'Telegram',
            'Linkedin',
            'Vk',
            'Wykop',
            'Facebook',
            'WhatsApp',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Russian',
          message: '\n\n👋 Здравствуйте! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'sv':
      case 'sv-SE':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'WeChat',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Swedish',
          message: '\n\n👋 Hej! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'th':
      case 'th-TH':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Thai',
          message: '\n\n👋 สวัสดี! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'tl':
      case 'tl-PH':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'WeChat',
            'Telegram',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Filipino',
          message: '\n\n👋 Kamusta! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'tr':
      case 'tr-TR':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Turkish',
          message: '\n\n👋 Merhaba! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'uk':
      case 'uk-UA':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'OKru',
            // 'Reddit',
            'Linkedin',
            'Facebook',
            'WhatsApp',
            'Telegram',
            'Vk',
            'Wykop',
            'Next time',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Ukrainian',
          message: '\n\n👋 Здравствуйте! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;

      case 'vi':
      case 'vi-VN':
        prompt = {
          choices: [
            'Twitter',
            'Github - ⭐️ or 👀 repo',
            'Linkedin',
            // 'Reddit',
            'Facebook',
            'WhatsApp',
            'WeChat',
            'Telegram',
            'Please dont ask me',
            '- - - - - - - -'
          ],
          language: 'Vietnamese',
          message: '\n\n👋 xin chào! 😀 \n\n🔥 Loving XgenCloud? 🔥\n\n🙏 Please mention a word about us to your friends & followers. 🙏\n\n'
            .green
        };
        break;
    }

    return prompt;
  }
}

export default Locales;
