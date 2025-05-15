import fs from 'fs';
import { promisify } from 'util';
import { Readable } from 'stream';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { GetSignedUrlConfig, StorageOptions } from '@google-cloud/storage';
import type { IStorageAdapterV2, XcFile } from '~/types/nc-plugin';
import { generateTempFilePath, waitForStreamClose } from '~/utils/pluginUtils';

interface GoogleCloudStorageInput {
  client_email: string;
  private_key: string;
  bucket: string;
  project_id?: string;
  uniform_bucket_level_access?: boolean;
}

export default class Gcs implements IStorageAdapterV2 {
  name = 'Gcs';

  private storageClient: Storage;
  private bucketName: string;
  private input: GoogleCloudStorageInput;

  constructor(input: GoogleCloudStorageInput) {
    this.input = input;
  }

  protected patchKey(key: string): string {
    let patchedKey = decodeURIComponent(key);
    if (patchedKey.startsWith(`${this.bucketName}/`)) {
      patchedKey = patchedKey.replace(`${this.bucketName}/`, '');
    }
    return patchedKey;
  }

  private aclConfig(): { predefinedAcl: 'publicRead' } | Record<string, never> {
    return this.input.uniform_bucket_level_access
      ? {}
      : { predefinedAcl: 'publicRead' };
  }

  public async init(): Promise<void> {
    const options: StorageOptions = {
      credentials: {
        client_email: this.input.client_email,
        // replace \n with real line breaks to avoid
        // error:0909006C:PEM routines:get_name:no start line
        private_key: this.input.private_key.replace(/\\n/gm, '\n'),
      },
    };

    if (this.input.project_id) {
      options.projectId = this.input.project_id;
    }

    this.bucketName = this.input.bucket;
    this.storageClient = new Storage(options);
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
        size: createStream.bytesWritten.toString(),
      });
      await promisify(fs.unlink)(tempFile);
      return true;
    } catch (e) {
      throw e;
    }
  }

  public async fileRead(key: string): Promise<Buffer> {
    const file = this.storageClient
      .bucket(this.bucketName)
      .file(this.patchKey(key));
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File ${this.patchKey(key)} does not exist`);
    }
    const [data] = await file.download();
    return data;
  }

  public async fileCreate(key: string, file: XcFile): Promise<string> {
    const [uploadResponse] = await this.storageClient
      .bucket(this.bucketName)
      .upload(file.path, {
        destination: this.patchKey(key),
        contentType: file?.mimetype || 'application/octet-stream',
        gzip: true,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
        ...this.aclConfig(),
      });

    return uploadResponse.publicUrl();
  }

  public async fileCreateByStream(
    key: string,
    stream: Readable,
    options: {
      mimetype?: string;
      size?: number;
    } = {},
  ): Promise<any> {
    const file = this.storageClient
      .bucket(this.bucketName)
      .file(this.patchKey(key));
    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(
          file.createWriteStream({
            gzip: true,
            metadata: {
              contentType: options.mimetype || 'application/octet-stream',
              cacheControl: 'public, max-age=31536000',
            },
            ...this.aclConfig(),
          }),
        )
        .on('finish', () => resolve())
        .on('error', reject);
    });

    return file.publicUrl();
  }

  public async fileCreateByUrl(
    destPath: string,
    url: string,
    { fetchOptions: { buffer } = { buffer: false } },
  ): Promise<{ url: string; data: any }> {
    const response = await axios.get(url, {
      httpAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
      httpsAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
      responseType: buffer ? 'arraybuffer' : 'stream',
    });

    const file = this.storageClient.bucket(this.bucketName).file(destPath);
    await file.save(response.data);

    return { url: file.publicUrl(), data: response.data };
  }

  public async fileDelete(path: string): Promise<void> {
    await this.storageClient.bucket(this.bucketName).file(path).delete();
  }

  public async fileReadByStream(key: string): Promise<Readable> {
    return this.storageClient
      .bucket(this.bucketName)
      .file(this.patchKey(key))
      .createReadStream();
  }

  public async getDirectoryList(path: string): Promise<string[]> {
    const [files] = await this.storageClient.bucket(this.bucketName).getFiles({
      prefix: path,
    });
    return files.map((file) => file.name);
  }

  public async getSignedUrl(
    key: string,
    expiresInSeconds = 7200,
    pathParameters?: { [key: string]: string },
  ): Promise<string> {
    const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
      responseDisposition: pathParameters?.ResponseContentDisposition,
      responseType: pathParameters?.ResponseContentType,
    };

    const [url] = await this.storageClient
      .bucket(this.bucketName)
      .file(this.patchKey(key))
      .getSignedUrl(options);

    return url;
  }

  public async scanFiles(globPattern: string): Promise<Readable> {
    // Remove all dots from the prefix
    globPattern = globPattern.replace(/\./g, '');

    // Remove the leading slash
    globPattern = globPattern.replace(/^\//, '');

    // Make sure pattern starts with nc/uploads/
    if (!globPattern.startsWith('nc/uploads/')) {
      globPattern = `nc/uploads/${globPattern}`;
    }

    const stream = new Readable({
      objectMode: true,
      read() {},
    });

    const fileStream = this.storageClient
      .bucket(this.input.bucket)
      .getFilesStream({
        prefix: globPattern,
        autoPaginate: true,
      });

    fileStream.on('error', (error) => {
      stream.emit('error', error);
    });

    fileStream.on('data', (file) => {
      stream.push(file.name);
    });

    fileStream.on('end', () => {
      stream.push(null);
    });

    return stream;
  }
}
