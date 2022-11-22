import fs from 'fs';
import { Client as MinioClient } from 'minio';
import { IStorageAdapterV2, XcFile } from 'nc-plugin';
import request from 'request';
import {
  waitForStreamClose,
  generateTempFilePath,
} from '../../utils/pluginUtils';

export default class Minio implements IStorageAdapterV2 {
  private minioClient: MinioClient;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    return new Promise((resolve, reject) => {
      // Configure the file stream and obtain the upload parameters
      const fileStream = fs.createReadStream(file.path);
      fileStream.on('error', (err) => {
        console.log('File Error', err);
        reject(err);
      });

      // uploadParams.Body = fileStream;
      // uploadParams.Key = key;
      const metaData = {
        'Content-Type': file.mimetype,
        // 'X-Amz-Meta-Testing': 1234,
        // 'run': 5678
      };
      // call S3 to retrieve upload file to specified bucket
      this.minioClient
        .putObject(this.input?.bucket, key, fileStream, metaData)
        .then(() => {
          resolve(
            `http${this.input.useSSL ? 's' : ''}://${this.input.endPoint}:${
              this.input.port
            }/${this.input.bucket}/${key}`
          );
        })
        .catch(reject);
    });
  }

  public async fileDelete(_path: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async fileRead(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.minioClient.getObject(this.input.bucket, key, (err, data) => {
        if (err) {
          return reject(err);
        }
        if (!data) {
          return reject(data);
        }
        return resolve(data);
      });
    });
  }

  public async init(): Promise<any> {
    // todo:  update in ui(checkbox and number field)
    this.input.port = +this.input.port || 9000;
    this.input.useSSL = this.input.useSSL === true;
    this.input.accessKey = this.input.access_key;
    this.input.secretKey = this.input.access_secret;

    this.minioClient = new MinioClient(this.input);
  }

  public async test(): Promise<boolean> {
    try {
      const tempFile = generateTempFilePath();
      const createStream = fs.createWriteStream(tempFile);
      await waitForStreamClose(createStream);
      await this.fileCreate('nc-test-file.txt', {
        path: tempFile,
        mimetype: '',
        originalname: 'temp.txt',
        size: '',
      });
      fs.unlinkSync(tempFile);
      return true;
    } catch (e) {
      throw e;
    }
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
        (err, _, body) => {
          if (err) return reject(err);

          uploadParams.Body = body;
          uploadParams.Key = key;

          // uploadParams.Body = fileStream;
          // uploadParams.Key = key;
          const metaData = {
            // 'Content-Type': file.mimetype
            // 'X-Amz-Meta-Testing': 1234,
            // 'run': 5678
          };
          // call S3 to retrieve upload file to specified bucket
          this.minioClient
            .putObject(this.input?.bucket, key, body, metaData)
            .then(() => {
              resolve(
                `http${this.input.useSSL ? 's' : ''}://${this.input.endPoint}:${
                  this.input.port
                }/${this.input.bucket}/${key}`
              );
            })
            .catch(reject);
        }
      );
    });
  }
}
