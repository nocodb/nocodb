import fs from 'fs';
import { Storage, StorageOptions } from '@google-cloud/storage';
import { IStorageAdapterV2, XcFile } from 'nc-plugin';
import request from 'request';
import {
  waitForStreamClose,
  generateTempFilePath,
} from '../../utils/pluginUtils';

export default class Gcs implements IStorageAdapterV2 {
  private storageClient: Storage;
  private bucketName: string;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  async fileCreate(key: string, file: XcFile): Promise<any> {
    const uploadResponse = await this.storageClient
      .bucket(this.bucketName)
      .upload(file.path, {
        destination: key,
        // Support for HTTP requests made with `Accept-Encoding: gzip`
        gzip: true,
        // By setting the option `destination`, you can change the name of the
        // object you are uploading to a bucket.
        metadata: {
          // Enable long-lived HTTP caching headers
          // Use only if the contents of the file will never change
          // (If the contents will change, use cacheControl: 'no-cache')
          cacheControl: 'public, max-age=31536000',
        },
      });

    return uploadResponse[0].publicUrl();
  }

  fileDelete(_path: string): Promise<any> {
    return Promise.resolve(undefined);
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

  public async init(): Promise<any> {
    const options: StorageOptions = {};

    // options.credentials = {
    //   client_email: process.env.NC_GCS_CLIENT_EMAIL,
    //   private_key: process.env.NC_GCS_PRIVATE_KEY
    // }
    //
    // this.bucketName = process.env.NC_GCS_BUCKET;
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
      fs.unlinkSync(tempFile);
      return true;
    } catch (e) {
      throw e;
    }
  }

  fileCreateByUrl(destPath: string, url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Configure the file stream and obtain the upload parameters
      request(
        {
          url: url,
          encoding: null,
        },
        (err, _, body) => {
          if (err) return reject(err);

          this.storageClient
            .bucket(this.bucketName)
            .file(destPath)
            .save(body)
            .then((res) => resolve(res))
            .catch(reject);
        }
      );
    });
  }
}
