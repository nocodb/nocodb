import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import mkdirp from 'mkdirp';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IStorageAdapterV2, XcFile } from 'nc-plugin';
import type { Readable } from 'stream';
import { NcError } from '~/helpers/catchError';
import { getToolDir } from '~/utils/nc-config';

export default class Local implements IStorageAdapterV2 {
  constructor() {}

  public async fileCreate(key: string, file: XcFile): Promise<any> {
    const destPath = this.validateAndNormalisePath(key);
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
    const destPath = this.validateAndNormalisePath(key);
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
          httpAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
          httpsAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
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

  public async fileCreateByStream(
    key: string,
    stream: Readable,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const destPath = this.validateAndNormalisePath(key);
      try {
        mkdirp(path.dirname(destPath)).then(() => {
          const writableStream = fs.createWriteStream(destPath);
          writableStream.on('finish', () => resolve());
          writableStream.on('error', (err) => reject(err));
          stream.pipe(writableStream);
        });
      } catch (e) {
        throw e;
      }
    });
  }

  public async fileReadByStream(key: string): Promise<Readable> {
    const srcPath = this.validateAndNormalisePath(key);
    return fs.createReadStream(srcPath, { encoding: 'utf8' });
  }

  public async getDirectoryList(key: string): Promise<string[]> {
    const destDir = this.validateAndNormalisePath(key);
    return fs.promises.readdir(destDir);
  }

  // todo: implement
  fileDelete(_path: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async fileRead(filePath: string): Promise<any> {
    try {
      const fileData = await fs.promises.readFile(
        this.validateAndNormalisePath(filePath, true),
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

  // method for validate/normalise the path for avoid path traversal attack
  public validateAndNormalisePath(
    fileOrFolderPath: string,
    throw404 = false,
  ): string {
    // Get the absolute path to the base directory
    const absoluteBasePath = path.resolve(getToolDir(), 'nc');

    // Get the absolute path to the file
    const absolutePath = path.resolve(
      path.join(getToolDir(), ...fileOrFolderPath.split('/')),
    );

    // Check if the resolved path is within the intended directory
    if (!absolutePath.startsWith(absoluteBasePath)) {
      if (throw404) {
        NcError.notFound();
      } else {
        NcError.badRequest('Invalid path');
      }
    }

    return absolutePath;
  }
}
