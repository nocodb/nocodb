import fs from 'fs';
import { promisify } from 'util';

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import request from 'request';
import {
  generateTempFilePath,
  waitForStreamClose,
} from '../../utils/pluginUtils';
import type { PutObjectRequest, S3ClientConfig } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2, XcFile } from 'nc-plugin';
import type { Readable } from 'stream';

export default class Backblaze implements IStorageAdapterV2 {
  private s3Client: S3Client;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    const uploadParams: PutObjectRequest = {
      ACL: 'public-read',
      ContentType: file.mimetype,
      Bucket: this.input.bucket,
      Key: key,
    };
    return new Promise((resolve, reject) => {
      // Configure the file stream and obtain the upload parameters
      const fileStream = fs.createReadStream(file.path);
      fileStream.on('error', (err) => {
        console.log('File Error', err);
        reject(err);
      });

      uploadParams.Body = fileStream;

      // call S3 to retrieve upload file to specified bucket
      this.s3Client.send(new PutObjectCommand(uploadParams), (err, data) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          resolve(
            `https://${this.input.bucket}.s3.${this.input.region}.backblazeb2.com/${key}`,
          );
        }
      });
    });
  }

  async fileCreateByUrl(key: string, url: string): Promise<any> {
    const uploadParams: any = {
      ACL: 'public-read',
    };
    return new Promise((resolve, reject) => {
      // Configure the file stream and obtain the upload parameters
      request(
        {
          url: url,
          encoding: null,
        },
        (err, httpResponse, body) => {
          if (err) return reject(err);

          uploadParams.Body = body;
          uploadParams.Key = key;
          uploadParams.ContentType = httpResponse.headers['content-type'];

          // call S3 to retrieve upload file to specified bucket
          this.s3Client.send(
            new PutObjectCommand(uploadParams),
            (err, data) => {
              if (err) {
                console.log(err);
                reject(err);
              } else {
                resolve(
                  `https://${this.input.bucket}.s3.${this.input.region}.backblazeb2.com/${key}`,
                );
              }
            },
          );
        },
      );
    });
  }

  // TODO - implement
  fileCreateByStream(_key: string, _stream: Readable): Promise<void> {
    return Promise.resolve(undefined);
  }

  // TODO - implement
  fileReadByStream(_key: string): Promise<Readable> {
    return Promise.resolve(undefined);
  }

  // TODO - implement
  getDirectoryList(_path: string): Promise<string[]> {
    return Promise.resolve(undefined);
  }

  patchRegion(region: string): string {
    // in v0.0.1, we constructed the endpoint with `region = s3.us-west-001`
    // in v0.0.2, `region` would be `us-west-001`
    // as backblaze states Region is the 2nd part of your S3 Endpoint in documentation
    if (region.startsWith('s3.')) {
      region = region.slice(3);
    }
    return region;
  }

  public async fileDelete(_path: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async fileRead(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.s3Client.send(
        new GetObjectCommand({ Key: key, Bucket: this.input.bucket }),
        (err, data) => {
          if (err) {
            return reject(err);
          }
          if (!data?.Body) {
            return reject(data);
          }
          return resolve(data.Body);
        },
      );
    });
  }

  public async init(): Promise<any> {
    const s3Options: S3ClientConfig = {
      region: this.patchRegion(this.input.region),
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
      endpoint: `https://s3.${this.input.region}.backblazeb2.com`,
    };

    this.s3Client = new S3Client(s3Options);
  }

  public async test(): Promise<boolean> {
    try {
      const tempFile = generateTempFilePath();
      const createStream = fs.createWriteStream(tempFile);
      await waitForStreamClose(createStream);
      await this.fileCreate('nc-test-file.txt', {
        path: tempFile,
        mimetype: 'text/plain',
        originalname: 'temp.txt',
        size: '',
      });
      await promisify(fs.unlink)(tempFile);
      return true;
    } catch (e) {
      throw e;
    }
  }
}
