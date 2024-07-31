import fs from 'fs';
import { promisify } from 'util';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import {
  GetObjectCommand,
  type PutObjectCommandInput,
  type PutObjectRequest,
  S3 as S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  GetObjectCommandInput,
  GetObjectCommandOutput,
  S3ClientConfig,
} from '@aws-sdk/client-s3';

import type { IStorageAdapterV2, XcFile } from 'nc-plugin';
import type { Readable } from 'stream';
import { generateTempFilePath, waitForStreamClose } from '~/utils/pluginUtils';

interface ScalewayObjectStorageInput {
  bucket: string;
  region: string;
  access_key: string;
  access_secret: string;
}

export default class ScalewayObjectStorage implements IStorageAdapterV2 {
  private s3Client: S3Client;
  private input: ScalewayObjectStorageInput;

  constructor(input: unknown) {
    this.input = input as ScalewayObjectStorageInput;
  }

  public async init(): Promise<any> {
    const s3Options: S3ClientConfig = {
      region: this.input.region,
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
      endpoint: `https://s3.${this.input.region}.scw.cloud`,
    };

    this.s3Client = new S3Client(s3Options);
  }

  get defaultParams() {
    return {
      Bucket: this.input.bucket,
    };
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

  public async fileRead(key: string) {
    const readParams: GetObjectCommandInput = {
      Key: key,
      Bucket: this.input.bucket,
    };

    try {
      const data: GetObjectCommandOutput = await this.s3Client.getObject(
        readParams,
      );
      if (!data.Body) {
        throw new Error('No data found in S3 object');
      }
      return data.Body;
    } catch (error) {
      throw error;
    }
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    const fileStream = fs.createReadStream(file.path);

    return this.fileCreateByStream(key, fileStream, {
      mimetype: file?.mimetype,
    });
  }

  async fileCreateByStream(
    key: string,
    stream: Readable,
    options?: {
      mimetype?: string;
    },
  ): Promise<void> {
    try {
      stream.on('error', (err) => {
        console.log('File Error', err);
        throw err;
      });

      const uploadParams = {
        ...this.defaultParams,
        Body: stream,
        Key: key,
        ContentType: options?.mimetype || 'application/octet-stream',
      };

      return await this.upload(uploadParams);
    } catch (error) {
      throw error;
    }
  }

  async fileCreateByUrl(key: string, url: string): Promise<any> {
    try {
      const response = await axios.get(url, {
        httpAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
        httpsAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
        responseType: 'stream',
      });
      const uploadParams: PutObjectRequest = {
        ...this.defaultParams,
        Body: response.data,
        Key: key,
        ContentType: response.headers['content-type'],
      };

      const data = await this.upload(uploadParams);
      return {
        url: data,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  }

  public async getSignedUrl(
    key,
    expiresInSeconds = 7200,
    pathParameters?: { [key: string]: string },
  ) {
    const command = new GetObjectCommand({
      Key: key,
      Bucket: this.input.bucket,
      ...pathParameters,
    });
    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  private async upload(uploadParams: PutObjectCommandInput): Promise<any> {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          ...uploadParams,
          ACL: 'public-read',
        },
      });

      const data = await upload.done();

      return data.Location;
    } catch (error) {
      console.error('Error uploading file', error);
      throw error;
    }
  }

  public async fileDelete(_path: string): Promise<any> {
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
}
