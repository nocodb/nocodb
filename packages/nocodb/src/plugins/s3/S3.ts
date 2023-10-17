import fs from 'fs';
import { promisify } from 'util';
import { GetObjectCommand, S3 as S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IStorageAdapterV2, XcFile } from 'nc-plugin';
import type { Readable } from 'stream';
import { generateTempFilePath, waitForStreamClose } from '~/utils/pluginUtils';

export default class S3 implements IStorageAdapterV2 {
  private s3Client: S3Client;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  get defaultParams() {
    return {
      ACL: 'private',
      Bucket: this.input.bucket,
    };
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    const uploadParams: any = {
      ...this.defaultParams,
      // ContentType: file.mimetype,
    };
    return new Promise((resolve, reject) => {
      // Configure the file stream and obtain the upload parameters
      const fileStream = fs.createReadStream(file.path);
      fileStream.on('error', (err) => {
        console.log('File Error', err);
        reject(err);
      });

      uploadParams.Body = fileStream;
      uploadParams.Key = key;

      // call S3 to retrieve upload file to specified bucket
      // call S3 to retrieve upload file to specified bucket
      this.upload(uploadParams)
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async fileCreateByUrl(key: string, url: string): Promise<any> {
    const uploadParams: any = {
      ...this.defaultParams,
    };
    return new Promise((resolve, reject) => {
      axios
        .get(url, {
          httpAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
          httpsAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
          responseType: 'arraybuffer',
        })
        .then((response) => {
          uploadParams.Body = response.data;
          uploadParams.Key = key;
          uploadParams.ContentType = response.headers['content-type'];

          // call S3 to retrieve upload file to specified bucket
          this.upload(uploadParams).then((data) => {
            resolve(data);
          });
        })
        .catch((error) => {
          reject(error);
        });
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
    return new Promise((resolve, reject) => {
      this.s3Client.getObject({ Key: key } as any, (err, data) => {
        if (err) {
          return reject(err);
        }
        if (!data?.Body) {
          return reject(data);
        }
        return resolve(data.Body);
      });
    });
  }

  public async getSignedUrl(key, expiresInSeconds = 7200) {
    const command = new GetObjectCommand({
      Key: key,
      Bucket: this.input.bucket,
    });
    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  public async init(): Promise<any> {
    // const s3Options: any = {
    //   params: {Bucket: process.env.NC_S3_BUCKET},
    //   region: process.env.NC_S3_REGION
    // };
    //
    // s3Options.accessKeyId = process.env.NC_S3_KEY;
    // s3Options.secretAccessKey = process.env.NC_S3_SECRET;

    const s3Options = {
      region: this.input.region,
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

  private async upload(uploadParams): Promise<any> {
    return new Promise((resolve, reject) => {
      // call S3 to retrieve upload file to specified bucket
      this.s3Client
        .putObject({ ...this.defaultParams, ...uploadParams })
        .then((data) => {
          if (data) {
            resolve(
              `https://${this.input.bucket}.s3.${this.input.region}.amazonaws.com/${uploadParams.Key}`,
            );
          }
        })
        .catch((err) => {
          console.error(err);
          reject(err);
        });
    });
  }
}
