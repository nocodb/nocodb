import fs from 'fs';
import { Readable } from 'stream';
import { Client as MinioClient } from 'minio';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IStorageAdapterV2, XcFile } from '~/types/nc-plugin';

interface MinioObjectStorageInput {
  bucket: string;
  access_key: string;
  access_secret: string;
  useSSL?: boolean;
  endPoint: string;
  port: number;
  ca?: string;
}

export default class Minio implements IStorageAdapterV2 {
  name = 'Minio';

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

    if (this.input.useSSL && this.input.ca) {
      this.minioClient.setRequestOptions({
        ca: this.input.ca,
      });
    }
  }

  public async test(): Promise<boolean> {
    try {
      const createStream = Readable.from(['Hello from Minio, NocoDB']);
      await this.fileCreateByStream('nc-test-file.txt', createStream);
      return true;
    } catch (e) {
      throw e;
    }
  }

  public async fileRead(key: string): Promise<any> {
    const data = await this.minioClient.getObject(this.input.bucket, key);

    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      data.on('data', (chunk) => {
        chunks.push(chunk);
      });

      data.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });

      data.on('error', (err) => {
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
      size?: number;
    },
  ): Promise<any> {
    try {
      const streamError = new Promise<void>((_, reject) => {
        stream.on('error', (err) => {
          reject(err);
        });
      });

      const uploadParams = {
        Key: key,
        Body: stream,
        metaData: {
          ContentType: options?.mimetype,
          size: options?.size,
        },
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
    const response = await axios.get(url, {
      httpAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
      httpsAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
      responseType: buffer ? 'arraybuffer' : 'stream',
    });

    const uploadParams = {
      ACL: 'public-read',
      Key: key,
      Body: response.data,
      metaData: {
        ContentType: response.headers['content-type'],
      },
    };

    const responseUrl = await this.upload(uploadParams);

    return {
      url: responseUrl,
      data: response.data,
    };
  }

  private async upload(uploadParams: {
    Key: string;
    Body: Readable;
    metaData: { [key: string]: string | number };
  }): Promise<any> {
    try {
      await this.minioClient.putObject(
        this.input.bucket,
        uploadParams.Key,
        uploadParams.Body,
        uploadParams.metaData as any,
      );

      if (this.input.useSSL && this.input.port === 443) {
        return `https://${this.input.endPoint}/${uploadParams.Key}`;
      } else if (!this.input.useSSL && this.input.port === 80) {
        return `http://${this.input.endPoint}/${uploadParams.Key}`;
      } else {
        return `http${this.input.useSSL ? 's' : ''}://${this.input.endPoint}:${
          this.input.port
        }/${uploadParams.Key}`;
      }
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
    if (
      key.startsWith(`${this.input.bucket}/nc/uploads`) ||
      key.startsWith(`${this.input.bucket}/nc/thumbnails`)
    ) {
      key = key.replace(`${this.input.bucket}/`, '');
    }

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
    throw new Error('Method not implemented.');
  }

  public async scanFiles(_globPattern: string): Promise<Readable> {
    return Promise.resolve(undefined);
  }
}
