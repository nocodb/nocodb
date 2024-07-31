import fs from 'fs';
import { promisify } from 'util';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import { Upload } from '@aws-sdk/lib-storage';
import { GetObjectCommand, S3 as S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  GetObjectCommandInput,
  GetObjectCommandOutput,
  PutObjectCommandInput,
  PutObjectRequest,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import type { IStorageAdapterV2, XcFile } from 'nc-plugin';
import type { Readable } from 'stream';
import { generateTempFilePath, waitForStreamClose } from '~/utils/pluginUtils';

export default class Backblaze implements IStorageAdapterV2 {
  private s3Client: S3Client;
  private input: {
    bucket: string;
    region: string;
    access_key: string;
    access_secret: string;
  };

  constructor(input: unknown) {
    this.input = input as {
      bucket: string;
      region: string;
      access_key: string;
      access_secret: string;
    };
  }

  get defaultParams() {
    return {
      Bucket: this.input.bucket,
    };
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    const fileStream = fs.createReadStream(file.path);

    return this.fileCreateByStream(key, fileStream, {
      mimetype: file?.mimetype,
    });
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

  public async init(): Promise<any> {
    const s3Options: S3ClientConfig = {
      region: this.patchRegion(this.input.region),
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
    };

    s3Options.endpoint = `https://s3.${s3Options.region}.backblazeb2.com`;
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

  private async upload(uploadParams: PutObjectCommandInput): Promise<any> {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: uploadParams,
      });

      const data = await upload.done();

      if (data) {
        return `https://${this.input.bucket}.s3.${this.input.region}.backblazeb2.com/${uploadParams.Key}`;
      }
    } catch (error) {
      console.error('Error uploading file', error);
      throw error;
    }
  }
}
