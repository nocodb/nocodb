import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import mkdirp from 'mkdirp';

import axios from 'axios';
import NcConfigFactory from '../../../../utils/NcConfigFactory';
import type { IStorageAdapterV2, XcFile } from 'nc-plugin';

export default class Local implements IStorageAdapterV2 {
  constructor() {}

  public async fileCreate(key: string, file: XcFile): Promise<any> {
    const destPath = path.join(NcConfigFactory.getToolDir(), ...key.split('/'));
    try {
      await mkdirp(path.dirname(destPath));
      const data = await promisify(fs.readFile)(file.path);
      await promisify(fs.writeFile)(destPath, data);
      await promisify(fs.unlink)(file.path);
      // await fs.promises.rename(file.path, destPath);
    } catch (e) {
      throw e;
    }
  }

  async fileCreateByUrl(key: string, url: string): Promise<any> {
    const destPath = path.join(NcConfigFactory.getToolDir(), ...key.split('/'));
    return new Promise((resolve, reject) => {
      axios
        .get(url, {
          responseType: 'stream',
          headers: {
            accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'no-cache',
            pragma: 'no-cache',
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
            origin: 'https://www.airtable.com/',
          },
        })
        .then(async (response) => {
          await mkdirp(path.dirname(destPath));
          const file = fs.createWriteStream(destPath);
          // close() is async, call cb after close completes
          file.on('finish', () => {
            file.close((err) => {
              if (err) {
                return reject(err);
              }
              resolve(null);
            });
          });

          file.on('error', (err) => {
            // Handle errors
            fs.unlink(destPath, () => reject(err.message)); // delete the (partial) file and then return the error
          });

          response.data.pipe(file);
        })
        .catch((err) => {
          reject(err.message);
        });
    });
  }

  // todo: implement
  fileDelete(_path: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async fileRead(filePath: string): Promise<any> {
    try {
      const fileData = await fs.promises.readFile(
        path.join(NcConfigFactory.getToolDir(), ...filePath.split('/'))
      );
      return fileData;
    } catch (e) {
      throw e;
    }
  }

  init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  test(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
