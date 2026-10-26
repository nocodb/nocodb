import fs from 'fs';
import { promisify } from 'util';
import { Readable } from 'stream';
import path from 'path';
import { Logger } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import type { PutObjectRequest, S3 as S3Client } from '@aws-sdk/client-s3';
import type { IStorageAdapterV2, XcFile } from '~/types/nc-plugin';
import {
  fetchSourceFile,
  generateTempFilePath,
  waitForStreamClose,
} from '~/utils/pluginUtils';
import { NcError } from '~/helpers/ncError';

const logger = new Logger('GenericS3');

interface GenericObjectStorageInput {
  bucket: string;
  region?: string;
  access_key?: string;
  access_secret?: string;
}

export default class GenericS3 implements IStorageAdapterV2 {
  public name;

  protected s3Client: S3Client;
  protected input: GenericObjectStorageInput;

  constructor(input: GenericObjectStorageInput) {
    this.input = input;
  }

  protected get defaultParams() {
    return {
      Bucket: this.input.bucket,
    };
  }

  public async init(): Promise<any> {
    // Placeholder, should be initialized in child class
  }

  protected patchKey(key: string): string {
    return key;
  }

  protected patchUploadReturnKey(key: string): string {
    return key;
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
      NcError._.pluginTestError(e?.message);
    }
  }

  public async fileRead(key: string): Promise<any> {
    try {
      const fileStream = await this.fileReadByStream(key);

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
    } catch (error) {
      NcError._.storageFileReadError(error.message);
    }
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    try {
      // fileCreateByStream rejects on a stream error.
      const fileStream = fs.createReadStream(file.path);

      return await this.fileCreateByStream(key, fileStream, {
        mimetype: file?.mimetype,
      });
    } catch (error) {
      NcError._.storageFileCreateError(error.message);
    }
  }

  async fileCreateByStream(
    key: string,
    stream: Readable,
    options?: {
      mimetype?: string;
    },
  ): Promise<string | null> {
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
      NcError._.storageFileStreamError(error.message);
    }
  }

  async fileCreateByUrl(
    key: string,
    url: string,
    { fetchOptions: { buffer } = { buffer: false } },
  ): Promise<any> {
    return fetchSourceFile(url, { buffer }, async (response) => {
      try {
        const uploadParams: PutObjectRequest = {
          ...this.defaultParams,
          Body: response.data,
          Key: key,
          ContentType: response.headers['content-type'] as string,
        };

        const data = await this.upload(uploadParams);
        return {
          url: data,
          data: response.data,
        };
      } catch (error) {
        NcError._.storageFileCreateError(
          `Failed to create file from URL: ${error.message}`,
        );
      }
    });
  }

  public async getSignedUrl(
    key,
    expiresInSeconds = 7200,
    pathParameters?: { [key: string]: string },
  ) {
    try {
      const command = new GetObjectCommand({
        Key: this.patchKey(key),
        Bucket: this.input.bucket,
        ...pathParameters,
      });
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      NcError._.storageFileReadError(
        `Failed to generate signed URL: ${error.message}`,
      );
    }
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

      return this.patchUploadReturnKey(data.Location);
    } catch (error) {
      NcError._.storageFileCreateError(error.message);
    }
  }

  async fileReadByStream(
    key: string,
    options?: { encoding?: string; start?: number; end?: number },
  ): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Key: this.patchKey(key),
        Bucket: this.input.bucket,
        ...(options?.start !== undefined && {
          Range: `bytes=${options.start}-${options.end ?? ''}`,
        }),
      });

      const { Body } = await this.s3Client.send(command);

      const stream = Body as Readable;

      // Readers get the error from the stream; throwing in a listener would crash the process.
      stream.on('error', (error) => {
        logger.warn(`Storage read stream failed: ${error.message}`);
      });

      return stream;
    } catch (error) {
      NcError._.storageFileStreamError(error.message);
    }
  }

  public async fileSize(key: string): Promise<number> {
    try {
      const { ContentLength } = await this.s3Client.send(
        new HeadObjectCommand({
          Key: this.patchKey(key),
          Bucket: this.input.bucket,
        }),
      );

      return ContentLength ?? 0;
    } catch (error) {
      NcError._.storageFileReadError(error.message);
    }
  }

  public async getDirectoryList(prefix: string): Promise<string[]> {
    try {
      const response = await this.s3Client.listObjectsV2({
        Prefix: prefix,
        Bucket: this.input.bucket,
      });

      return response.Contents.map((content) => {
        return path.basename(content.Key);
      });
    } catch (error) {
      NcError._.storageFileReadError(
        `Failed to list directory: ${error.message}`,
      );
    }
  }

  public async fileDelete(key: string): Promise<any> {
    try {
      await this.s3Client.deleteObject({
        Key: this.patchKey(key),
        Bucket: this.input.bucket,
      });
      return true;
    } catch (error) {
      NcError._.storageFileDeleteError(error.message);
    }
  }

  public async scanFiles(globPattern: string): Promise<Readable> {
    // remove all dots from the glob pattern
    globPattern = globPattern.replace(/\./g, '');

    // remove the leading slash
    globPattern = globPattern.replace(/^\//, '');

    // make sure pattern starts with nc/uploads/
    if (!globPattern.startsWith('nc/uploads/')) {
      globPattern = `nc/uploads/${globPattern}`;
    }

    // S3 does not support glob so remove *
    globPattern = globPattern.replace(/\*/g, '');

    const s3Client = this.s3Client;
    const bucket = this.input.bucket;

    // fetch the next page only when the consumer asks for more keys
    async function* listKeys() {
      let continuationToken: string | undefined;
      do {
        const response = await s3Client.listObjectsV2({
          Bucket: bucket,
          Prefix: globPattern,
          ...(continuationToken
            ? { ContinuationToken: continuationToken }
            : {}),
        });

        // the SDK omits Contents when nothing matches the prefix
        for (const content of response.Contents ?? []) {
          yield content.Key;
        }

        continuationToken = response.IsTruncated
          ? response.NextContinuationToken
          : undefined;
      } while (continuationToken);
    }

    return Readable.from(listKeys());
  }

  public async fileDeleteBatch(keys: string[]): Promise<number> {
    let deleted = 0;
    // DeleteObjects takes at most 1000 keys per request
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      try {
        const response = await this.s3Client.deleteObjects({
          Bucket: this.input.bucket,
          Delete: {
            Objects: chunk.map((key) => ({ Key: this.patchKey(key) })),
            Quiet: true,
          },
        });
        deleted += chunk.length - (response.Errors?.length ?? 0);
      } catch (error) {
        NcError._.storageFileDeleteError(error.message);
      }
    }
    return deleted;
  }

  getUploadedPath(path: string): { path?: string; url?: string } {
    return { path };
  }
}
