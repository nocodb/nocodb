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
import type { PutObjectRequest, S3ClientConfigType } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2, XcFile } from 'nc-plugin';
import type { Readable } from 'stream';

export default class R2 implements IStorageAdapterV2 {
  private s3Client: S3Client;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    const uploadParams: PutObjectRequest = {
      Bucket: this.input.bucket,
      Key: key,
      ACL: 'public-read',
      ContentType: file.mimetype,
    };
    return new Promise((resolve, reject) => {
      // Configure the file stream and obtain the upload parameters
      const fileStream = fs.createReadStream(file.path);
      fileStream.on('error', (err) => {
        console.log('File Error', err);
        reject(err);
      });

      uploadParams.Body = fileStream;
      this.s3Client.send(new PutObjectCommand(uploadParams), (err, data) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          resolve(this.input.public_url + '/' + key);
        }
      });
    });
  }

  async fileCreateByUrl(key: string, url: string): Promise<any> {
    const uploadParams: PutObjectRequest = {
      ACL: 'public-read',
      Bucket: this.input.bucket,
      Key: key,
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
          this.s3Client.send(
            new PutObjectCommand(uploadParams),
            (err, data) => {
              if (err) {
                console.log(err);
                reject(err);
              } else {
                resolve(this.input.public_url + '/' + key);
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

  public async fileDelete(_path: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async fileRead(key: string): Promise<any> {
    const requestCommand = new GetObjectCommand({
      Bucket: this.input.bucket,
      Key: key,
    });

    return new Promise((resolve, reject) => {
      this.s3Client.send(requestCommand, (err, data) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          resolve(this.input.public_url + '/' + key);
        }
      });
    });
  }

  public async init(): Promise<any> {
    const s3Options: S3ClientConfigType = {
      region: 'auto',
      endpoint: this.input.hostname,
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
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
