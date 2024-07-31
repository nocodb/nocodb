import fs from 'fs';
import { promisify } from 'util';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import {
  GetObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { Upload } from '@aws-sdk/lib-storage';
import type { PutObjectRequest, S3 as S3Client } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2, XcFile } from 'nc-plugin';
import type { Readable } from 'stream';
import { generateTempFilePath, waitForStreamClose } from '~/utils/pluginUtils';

interface GenerocObjectStorageInput {
  bucket: string;
  region?: string;
  access_key: string;
  access_secret: string;
}

export default class GenericS3 implements IStorageAdapterV2 {
  protected s3Client: S3Client;
  protected input: GenerocObjectStorageInput;

  constructor(input: unknown) {
    this.input = input as GenerocObjectStorageInput;
  }

  protected get defaultParams() {
    return {
      Bucket: this.input.bucket,
    };
  }

  public async init(): Promise<any> {
    // Placeholder, should be initalized in child class
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

  public async fileRead(key: string): Promise<any> {
    const command = new GetObjectCommand({
      Key: key,
      Bucket: this.input.bucket,
    });

    const { Body } = await this.s3Client.send(command);

    const fileStream = Body as Readable;

    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      fileStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      fileStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });

      fileStream.on('error', (err) => {
        reject(err);
      });
    });
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
      const streamError = new Promise<void>((_, reject) => {
        stream.on('error', (err) => {
          reject(err);
        });
      });

      const uploadParams = {
        ...this.defaultParams,
        Body: stream,
        Key: key,
        ContentType: options?.mimetype || 'application/octet-stream',
      };

      const upload = this.upload(uploadParams);

      return await Promise.race([upload, streamError]);
    } catch (error) {
      throw error;
    }
  }

  async fileCreateByUrl(
    key: string,
    url: string,
    { fetchOptions: { buffer } = { buffer: false } },
  ): Promise<any> {
    try {
      const response = await axios.get(url, {
        httpAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
        httpsAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
        responseType: buffer ? 'arraybuffer' : 'stream',
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

  protected async upload(uploadParams: PutObjectCommandInput): Promise<any> {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          ACL: 'public-read',
          ...uploadParams,
        },
      });

      const data = await upload.done();

      return data.Location;
    } catch (error) {
      console.error('Error uploading file', error);
      throw error;
    }
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
