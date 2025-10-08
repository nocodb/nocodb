import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import mkdirp from 'mkdirp';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import { globStream } from 'glob';
import { Logger } from '@nestjs/common';
import type { IStorageAdapterV2, XcFile } from '~/types/nc-plugin';
import { validateAndNormaliseLocalPath } from '~/helpers/attachmentHelpers';
import { NcError } from '~/helpers/ncError';

export default class Local implements IStorageAdapterV2 {
  name = 'Local';
  protected logger = new Logger(Local.name);

  public async fileCreate(key: string, file: XcFile): Promise<any> {
    const destPath = validateAndNormaliseLocalPath(key);
    try {
      await mkdirp(path.dirname(destPath));
      const data = await promisify(fs.readFile)(file.path);
      await promisify(fs.writeFile)(destPath, data);
      await promisify(fs.unlink)(file.path);
      // await fs.promises.rename(file.path, destPath);
    } catch (e) {
      NcError._.storageFileCreateError(e.message);
    }
  }

  async fileCreateByUrl(
    key: string,
    url: string,
    { fetchOptions: { buffer } = { buffer: false } },
  ): Promise<any> {
    try {
      const destPath = validateAndNormaliseLocalPath(key);
      const response = await axios.get(url, {
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
      });

      await mkdirp(path.dirname(destPath));
      if (buffer) {
        await fs.promises.writeFile(destPath, Buffer.from(response.data));
        return {
          url: null,
          data: response.data,
        };
      } else {
        await this.fileCreateByStream(key, response.data);
        return {
          url: null,
          data: null,
        };
      }
    } catch (err) {
      NcError._.storageFileCreateError(
        `Failed to create file from URL: ${err.message}`,
      );
    }
  }

  public async fileCreateByStream(
    key: string,
    stream: Readable,
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const destPath = validateAndNormaliseLocalPath(key);
      try {
        mkdirp(path.dirname(destPath))
          .then(() => {
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
          })
          .catch((e) => {
            reject(e);
          });
      } catch (e) {
        NcError._.storageFileStreamError(e.message);
      }
    });
  }

  public async fileReadByStream(
    key: string,
    options: { encoding?: string },
  ): Promise<Readable> {
    try {
      const srcPath = validateAndNormaliseLocalPath(key);
      return fs.createReadStream(srcPath, {
        ...(options?.encoding && {
          encoding: options.encoding as BufferEncoding,
        }),
      });
    } catch (e) {
      NcError._.storageFileStreamError(e.message);
    }
  }

  public async getDirectoryList(key: string): Promise<string[]> {
    try {
      const destDir = validateAndNormaliseLocalPath(key);
      return fs.promises.readdir(destDir);
    } catch (e) {
      NcError._.storageFileReadError(`Failed to list directory: ${e.message}`);
    }
  }

  fileDelete(path: string): Promise<any> {
    try {
      return fs.promises.unlink(validateAndNormaliseLocalPath(path));
    } catch (e) {
      NcError._.storageFileDeleteError(e.message);
    }
  }

  public async fileRead(filePath: string): Promise<any> {
    try {
      const fileData = await fs.promises.readFile(
        validateAndNormaliseLocalPath(filePath, true),
      );
      return fileData;
    } catch (e) {
      NcError._.storageFileReadError(e.message);
    }
  }

  public async scanFiles(globPattern: string) {
    try {
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
    } catch (e) {
      NcError._.storageFileReadError(`Failed to scan files: ${e.message}`);
    }
  }

  init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  test(): Promise<boolean> {
    return Promise.resolve(false);
  }

  getUploadedPath(filePath: string): { path?: string; url?: string } {
    const usePath = filePath.startsWith('/')
      ? filePath.replace(/^\/+/, '')
      : filePath;

    return {
      path: path.join('download', usePath),
    };
  }
}
