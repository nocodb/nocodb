import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import mkdirp from 'mkdirp';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import { globStream } from 'glob';
import type { IStorageAdapterV2, XcFile } from '~/types/nc-plugin';
import { validateAndNormaliseLocalPath } from '~/helpers/attachmentHelpers';

export default class Local implements IStorageAdapterV2 {
  name = 'Local';

  public async fileCreate(key: string, file: XcFile): Promise<any> {
    const destPath = validateAndNormaliseLocalPath(key);
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

  async fileCreateByUrl(
    key: string,
    url: string,
    { fetchOptions: { buffer } = { buffer: false } },
  ): Promise<any> {
    const destPath = validateAndNormaliseLocalPath(key);
    return new Promise((resolve, reject) => {
      axios
        .get(url, {
          responseType: buffer ? 'arraybuffer' : 'stream',
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

          fs.writeFile(destPath, response.data, (err) => {
            if (err) {
              return reject(err);
            }
            resolve({
              url: null,
              data: response.data,
            });
          });
        })
        .catch((err) => {
          reject(err.message);
        });
    });
  }

  public async fileCreateByStream(
    key: string,
    stream: Readable,
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const destPath = validateAndNormaliseLocalPath(key);
      try {
        mkdirp(path.dirname(destPath)).then(() => {
          const writableStream = fs.createWriteStream(destPath);
          writableStream.on('finish', () => {
            this.fileRead(destPath)
              .then(() => {
                resolve(null);
              })
              .catch((e) => {
                reject(e);
              });
          });
          writableStream.on('error', (err) => reject(err));
          stream.pipe(writableStream);
        });
      } catch (e) {
        throw e;
      }
    });
  }

  public async fileReadByStream(
    key: string,
    options: { encoding?: string },
  ): Promise<Readable> {
    const srcPath = validateAndNormaliseLocalPath(key);
    return fs.createReadStream(srcPath, {
      ...(options?.encoding && {
        encoding: options.encoding as BufferEncoding,
      }),
    });
  }

  public async getDirectoryList(key: string): Promise<string[]> {
    const destDir = validateAndNormaliseLocalPath(key);
    return fs.promises.readdir(destDir);
  }

  fileDelete(path: string): Promise<any> {
    return fs.promises.unlink(validateAndNormaliseLocalPath(path));
  }

  public async fileRead(filePath: string): Promise<any> {
    try {
      const fileData = await fs.promises.readFile(
        validateAndNormaliseLocalPath(filePath, true),
      );
      return fileData;
    } catch (e) {
      throw e;
    }
  }

  public async scanFiles(globPattern: string) {
    // Normalize the path separator
    globPattern = globPattern.replace(/\//g, path.sep);

    // remove all dots from the glob pattern
    globPattern = globPattern.replace(/\./g, '');

    // remove the leading slash
    globPattern = globPattern.replace(/^\//, '');

    // Ensure the pattern starts with 'nc/uploads/'
    if (!globPattern.startsWith(path.join('nc', 'uploads'))) {
      globPattern = path.join('nc', 'uploads', globPattern);
    }

    const stream = globStream(globPattern, {
      nodir: true,
    });

    return Readable.from(stream);
  }

  init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  test(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
