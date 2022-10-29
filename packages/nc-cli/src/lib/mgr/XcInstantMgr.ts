import axios from 'axios';
import download from 'download';
import osInfo from 'linux-os-info';
import open from 'open';
import ora from 'ora';
import os from 'os';
import shell from 'shelljs';

import('colors');

const PROGRESS_WIDTH = 30;

class AppMgr {
  public static async install(args) {
    try {
      const spinner = ora({
        text: 'Downloading Desktop App from Github..'.green.bold(),
        spinner: 'dots2',
        color: 'green'
      }).start();
      const { src, dest } = await AppMgr.getDownloadLink(args);

      console.log(`\t${src}`);

      await download(src, '.').on('downloadProgress', progress => {
        // console.log(progress)
        // Report download progress
        const p = PROGRESS_WIDTH * progress.percent;
        spinner.text = `Downloading Desktop App now..\n[${Array.from(
          { length: PROGRESS_WIDTH },
          (_, i) => (i <= p ? '=' : ' ')
        ).join('')}] ${(progress.transferred / (1024 * 1024)).toFixed(2)}MB/${(
          progress.total /
          (1024 * 1024)
        ).toFixed(2)}MB\n`.green.bold();
      });
      // spinner.prefixText = '';
      spinner.succeed(
        `Installable downloaded successfully at ./${dest}`.green.bold()
      );
      console.log(`\nInstallable will open automatically now.`.green.bold);
      console.log(`If not, please install it manually.`.green.bold);
      if (os.type() === 'Windows_NT') {
        // open(dest, {wait: true, app: 'explorer.exe'})
      } else {
        open(dest, { wait: true });
      }
    } catch (e) {
      console.error(`Error in xc app.install`, e);
    }
  }

  public static async open(args) {
    try {
      const runCommand = AppMgr.getOpenCommand(args);
      if (!runCommand) {
        return;
      }
      if (shell.exec(runCommand).code !== 0) {
        shell.echo(`\n\nError running command internally`.red);
        shell.echo(`\nExiting...`.red);
        shell.exit(1);
      }
    } catch (e) {
      console.error(`Error in xc app.open`, e);
    }
  }

  public static async getDownloadLink(args): Promise<any> {
    try {
      let src;
      let dest;
      const urls: any = {};

      const res = await axios.get(
        'https://api.github.com/repos/xgenecloud/xc-desktop-app/releases?page=1'
      );

      let status = 0;

      for (let i = 0; i < res.data.length && status !== 15; i++) {
        const assets = res.data[i].assets;
        for (const { name, browser_download_url } of assets) {
          switch (
            name
              .split('.')
              .pop()
              .toLowerCase()
          ) {
            case 'dmg':
              urls.dmg = urls.dmg || browser_download_url;
              status = status | 1;
              break;
            case 'deb':
              urls.deb = urls.deb || browser_download_url;
              status = status | 2;
              break;
            case 'rpm':
              urls.rpm = urls.rpm || browser_download_url;
              status = status | 4;
              break;
            case 'exe':
              urls.exe = urls.exe || browser_download_url;
              status = status | 8;
              break;
          }
        }
      }

      switch (os.type()) {
        case 'Linux':
          const linuxInfo = osInfo({ mode: 'sync' });
          if (args.debian) {
            src = urls.deb;
          } else if (args.rpm) {
            src = urls.rpm;
          } else {
            switch (linuxInfo.id) {
              case 'ubuntu':
              case 'raspberry':
                src = urls.deb;
                break;
              case 'fedora':
                src = urls.rpm;
                break;
              default:
                src = urls.rpm;
            }
          }
          break;
        case 'Darwin':
          src = urls.dmg;
          break;
        case 'Windows_NT':
          src = urls.exe;
          break;
        default:
          break;
      }

      dest = src.split('/').pop();
      return { src, dest };
    } catch (e) {
      console.log(e);
    }
  }

  public static getOpenCommand(_args): any {
    switch (os.type()) {
      case 'Linux':
        return 'xgenecloud';
        break;
      case 'Darwin':
        return 'open -a xgenecloud';
        break;
      case 'Windows_NT':
        console.info('Open xgenecloud desktop app from Windows start menu');

        break;
      default:
        break;
    }
  }
}

export default AppMgr;
