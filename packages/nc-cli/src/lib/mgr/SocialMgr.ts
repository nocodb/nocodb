import fs from 'fs';
import inquirer from 'inquirer';
import open from 'open';
import path from 'path';
import Locales from '../util/Locales';
import socialShareRules from './cliRules.json';
import socialText from './SocialText';

class SocialMgr {
  public static async share(args) {
    try {
      const shareUrl = await SocialMgr.getShareUrl({
        text: 'A revolutionary API framework with a Desktop App.',
        type: args.type,
        url: 'https://NocoDB.com'
      });
      open(shareUrl, { wait: true });
    } catch (e) {
      console.error(`Error in xc ${args.type}`, e);
    }
  }

  public static async shareSocial(_args = {}) {
    try {
      const prompt: any = Locales.getPrompt();

      const answer = await inquirer.prompt([
        {
          choices: prompt.choices,
          message: prompt.message,
          name: 'media',
          type: 'list'
        }
      ]);

      switch (answer.media) {
        case 'Next time':
          break;

        case 'Please dont ask me':
          SocialMgr.setShareRules('dontPrompt', true);
          break;

        case '- - -':
          break;

        case 'Github - ⭐️ or 👀 repo':
          open('https://github.com/NocoDB/NocoDB', { wait: true });
          break;

        default:
          const text = SocialMgr.getShareText(answer.media);
          // const url = SocialMgr._getShareContentSuffix(answer.media);
          const shareUrl = await SocialMgr.getShareUrl({
            text,
            type: answer.media,
            url: 'https://NocoDB.com'
          });

          open(shareUrl, { wait: true });
          break;
      }
    } catch (e) {
      console.error(`Error in xc share`, e);
    }
  }

  public static getShareUrl({ type, url, text }): any {
    const encUrl = encodeURIComponent(url);
    const encText = encodeURIComponent(text);

    console.log(__dirname, process.cwd());

    switch (type) {
      case 'Twitter':
        return `https://twitter.com/intent/tweet?url=${encUrl}&text=${encText}&hashtags=xgenecloud`;
        break;

      case 'Facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encUrl}&title=${encText}&summary=${encText}&quote=${encText}&hashtag=%23xgenecloud`;
        break;

      case 'Linkedin':
        return `https://www.linkedin.com/shareArticle?mini=true&url=${encUrl}&title=${encText}&summary=${encText}`;
        break;

      case 'Reddit':
        return `https://www.reddit.com/submit?url=${encUrl}&title=${encText}`;
        break;

      case 'WhatsApp':
        return `https://api.whatsapp.com/send?text=${encText}%0D%0A${encUrl}`;
        break;

      case 'Telegram':
        return `https://telegram.me//share/url?url=${encUrl}&text=${encText}`;
        break;

      case 'Renren':
        return `http://widget.renren.com/dialog/share?resourceUrl=${encUrl}&srcUrl=${encUrl}&title=${encText}&description=${encText}`;
        break;

      case 'Line':
        return `http://line.me/R/msg/text/?${encText}%0D%0A${encUrl}`;
        break;

      case 'Vk':
        return `http://vk.com/share.php?url=${encUrl}&title=${encText}&comment=${encText}`;
        break;

      case '新浪微博':
        return `http://service.weibo.com/share/share.php?url=${encUrl}&appkey=&title=${encText}&pic=&ralateUid=`;
        break;

      case '豆瓣':
        return `http://www.douban.com/recommend/?url=${encUrl}&title=${encText}`;
        break;

      case 'Wykop':
        return `https://www.addtoany.com/add_to/wykop?linkurl=${encUrl}&linkname=${encText}`;
        break;

      case 'OKru':
        return `https://connect.ok.ru/dk?st.cmd=WidgetSharePreview&st.shareUrl=${encUrl}`;
        break;

      case 'WeChat':
        return `https://www.addtoany.com/add_to/wechat?linkurl=${encUrl}&linkname=${encText}`;
        break;
    }
  }

  public static setShareRules(key, value) {
    socialShareRules[key] = value;
    fs.writeFileSync(
      path.join(__dirname, 'cliRules.json'),
      JSON.stringify(socialShareRules)
    );
  }

  public static setCreatedApis(value) {
    if (socialShareRules.dontPrompt) {
      return;
    }
    socialShareRules.createdApis = value;
    socialShareRules.prompt = value;
    fs.writeFileSync(
      path.join(__dirname, 'cliRules.json'),
      JSON.stringify(socialShareRules)
    );
  }

  public static async showPrompt() {
    try {
      if (
        socialShareRules.createdApis &&
        socialShareRules.prompt &&
        !socialShareRules.dontPrompt
      ) {
        await SocialMgr.shareSocial();
        SocialMgr.setShareRules('prompt', false);
      }
    } catch (e) {
      /* ignore any error while showing social prompt*/
    }
  }

  public static getShareText(socialMediaType) {
    return (
      SocialMgr._getShareContentPrefix(socialMediaType) +
      SocialMgr._getShareContentMid(socialMediaType) +
      SocialMgr._getShareContentSuffix(socialMediaType)
    );
  }

  public static _getShareContentPrefix(_socialMediaType) {
    return socialText.prefix[
      Math.floor(Math.random() * socialText.prefix.length)
    ];
  }

  public static _getShareContentMid(_socialMediaType) {
    return socialText.mid[Math.floor(Math.random() * socialText.mid.length)];
  }

  public static _getShareContentSuffix(_socialMediaType) {
    return socialText.suffix[
      Math.floor(Math.random() * socialText.suffix.length)
    ];
  }
}

export default SocialMgr;
