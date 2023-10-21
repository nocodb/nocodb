import fs from 'fs';
import { promisify } from 'util';
import AWS from 'aws-sdk';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IStorageAdapterV2, XcFile } from 'nc-plugin';
import type { Readable } from 'stream';
import { generateTempFilePath, waitForStreamClose } from '~/utils/pluginUtils';

export default class Vultr implements IStorageAdapterV2 {
  private s3Client: AWS.S3;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    const uploadParams: any = {
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
      uploadParams.Key = key;

      // call S3 to retrieve upload file to specified bucket
      this.s3Client.upload(uploadParams, (err, data) => {
        if (err) {
          console.log('Error', err);
          reject(err);
        }
        if (data) {
          resolve(data.Location);
        }
      });
    });
  }

  async fileCreateByUrl(key: string, url: string): Promise<any> {
    const uploadParams: any = {
      ACL: 'public-read',
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
          this.s3Client.upload(uploadParams, (err1, data) => {
            if (err1) {
              console.log('Error', err1);
              reject(err1);
            }
            if (data) {
              resolve(data.Location);
            }
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

  public async init(): Promise<any> {
    const s3Options: any = {
      params: { Bucket: this.input.bucket },
      region: this.input.region,
    };

    s3Options.accessKeyId = this.input.access_key;
    s3Options.secretAccessKey = this.input.access_secret;

    s3Options.endpoint = new AWS.Endpoint(this.input.hostname);

    this.s3Client = new AWS.S3(s3Options);
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
