import fs from 'fs';
import { promisify } from 'util';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { GetSignedUrlConfig, StorageOptions } from '@google-cloud/storage';
import type { IStorageAdapterV2, XcFile } from '~/types/nc-plugin';
import type { Readable } from 'stream';
import { generateTempFilePath, waitForStreamClose } from '~/utils/pluginUtils';

interface GoogleCloudStorageInput {
  client_email: string;
  private_key: string;
  bucket: string;
  project_id: string;
}

export default class Gcs implements IStorageAdapterV2 {
  name = 'Gcs';

  private storageClient: Storage;
  private bucketName: string;
  private input: GoogleCloudStorageInput;

  constructor(input: unknown) {
    this.input = input as GoogleCloudStorageInput;
  }

  public async init(): Promise<any> {
    const options: StorageOptions = {};
    options.credentials = {
      client_email: this.input.client_email,
      // replace \n with real line breaks to avoid
      // error:0909006C:PEM routines:get_name:no start line
      private_key: this.input.private_key.replace(/\\n/gm, '\n'),
    };

    // default project ID would be used if it is not provided
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

  public fileRead(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const file = this.storageClient.bucket(this.bucketName).file(key);
      // Check for existence, since gcloud-node seemed to be caching the result
      file.exists((err, exists) => {
        if (exists) {
          file.download((downerr, data) => {
            if (err) {
              return reject(downerr);
            }
            return resolve(data);
          });
        } else {
          reject(err);
        }
      });
    });
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    const uploadResponse = await this.storageClient
      .bucket(this.bucketName)
      .upload(file.path, {
        destination: key,
        contentType: file?.mimetype || 'application/octet-stream',
        gzip: true,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

    return uploadResponse[0].publicUrl();
  }

  async fileCreateByStream(
    key: string,
    stream: Readable,
    options?: {
      mimetype?: string;
    },
  ): Promise<void> {
    const uploadResponse = await this.storageClient
      .bucket(this.bucketName)
      .file(key)
      .save(stream, {
        // Support for HTTP requests made with `Accept-Encoding: gzip`
        gzip: true,
        // By setting the option `destination`, you can change the name of the
        // object you are uploading to a bucket.
        metadata: {
          contentType: options.mimetype || 'application/octet-stream',
          // Enable long-lived HTTP caching headers
          // Use only if the contents of the file will never change
          // (If the contents will change, use cacheControl: 'no-cache')
          cacheControl: 'public, max-age=31536000',
        },
      });

    return uploadResponse[0].publicUrl();
  }

  async fileCreateByUrl(
    destPath: string,
    url: string,
    { fetchOptions: { buffer } = { buffer: false } },
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      axios
        .get(url, {
          httpAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
          httpsAgent: useAgent(url, { stopPortScanningByUrlRedirection: true }),
          responseType: buffer ? 'arraybuffer' : 'stream',
        })
        .then((response) => {
          this.storageClient
            .bucket(this.bucketName)
            .file(destPath)
            .save(response.data)
            .then((res) => resolve({ url: res, data: response.data }))
            .catch(reject);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  fileDelete(_path: string): Promise<any> {
    throw new Error('Method not implemented.');
  }

  // TODO - implement
  fileReadByStream(_key: string): Promise<Readable> {
    return Promise.resolve(undefined);
  }

  // TODO - implement
  getDirectoryList(_path: string): Promise<string[]> {
    return Promise.resolve(undefined);
  }

  public async getSignedUrl(
    key,
    expiresInSeconds = 7200,
    pathParameters?: { [key: string]: string },
  ) {
    const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
      extensionHeaders: pathParameters,
    };

    const [url] = await this.storageClient
      .bucket(this.bucketName)
      .file(key)
      .getSignedUrl(options);

    return url;
  }

  public async scanFiles(_globPattern: string): Promise<Readable> {
    return Promise.resolve(undefined);
  }
}
