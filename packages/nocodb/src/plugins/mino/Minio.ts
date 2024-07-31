import fs from 'fs';
import { promisify } from 'util';
import { Client as MinioClient } from 'minio';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IStorageAdapterV2, XcFile } from 'nc-plugin';
import type { Readable } from 'stream';

import { generateTempFilePath, waitForStreamClose } from '~/utils/pluginUtils';

interface MinioObjectStorageInput {
  bucket: string;
  access_key: string;
  access_secret: string;
  useSSL?: boolean;
  endPoint: string;
  port: number;
}

export default class Minio implements IStorageAdapterV2 {
  private minioClient: MinioClient;
  private input: MinioObjectStorageInput;

  constructor(input: unknown) {
    this.input = input as MinioObjectStorageInput;
  }

  public async init(): Promise<any> {
    const minioOptions = {
      port: +this.input.port || 9000,
      endPoint: this.input.endPoint,
      useSSL: this.input.useSSL === true,
      accessKey: this.input.access_key,
      secretKey: this.input.access_secret,
    };

    this.minioClient = new MinioClient(minioOptions);
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
      await promisify(fs.unlink)(tempFile);
      return true;
    } catch (e) {
      throw e;
    }
  }

  public async fileRead(key: string): Promise<any> {
    try {
      const data = await this.minioClient.getObject(this.input.bucket, key);
      if (!data) {
        throw new Error('No data found in Minio');
      }
      return data;
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
      size?: number;
    },
  ): Promise<any> {
    const uploadParams = {
      Key: key,
      Body: stream,
      metaData: {
        ContentType: options?.mimetype,
      },
    };

    return this.upload(uploadParams);
  }

  async fileCreateByUrl(key: string, url: string): Promise<any> {
    const response = await axios.get(url, {
      httpAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
      httpsAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
      responseType: 'stream',
    });

    const uploadParams = {
      ACL: 'public-read',
      Key: key,
      Body: response.data,
      metaData: {
        ContentType: response.headers['content-type'],
      },
    };

    const responseUrl = this.upload(uploadParams);

    return {
      url: responseUrl,
      data: response.data,
    };
  }

  private async upload(uploadParams: {
    Key: string;
    Body: Readable;
    metaData: { [key: string]: string };
  }): Promise<any> {
    try {
      const data = await this.minioClient.putObject(
        this.input.bucket,
        uploadParams.Key,
        uploadParams.Body,
        uploadParams.metaData,
      );

      if (!data) {
        throw new Error('No data found in Minio');
      }

      return `http${this.input.useSSL ? 's' : ''}://${this.input.endPoint}:${
        this.input.port
      }/${this.input.bucket}/${uploadParams.Key}`;
    } catch (error) {
      console.error('Error uploading file', error);
      throw error;
    }
  }

  public async getSignedUrl(
    key,
    expiresInSeconds = 7200,
    pathParameters?: { [key: string]: string },
  ) {
    return this.minioClient.presignedGetObject(
      this.input.bucket,
      key,
      expiresInSeconds,
      pathParameters,
    );
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
}
