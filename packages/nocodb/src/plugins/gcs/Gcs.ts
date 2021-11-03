import fs from 'fs';
import path from 'path';

import { Storage, StorageOptions } from '@google-cloud/storage';
import { IStorageAdapter, XcFile } from 'nc-plugin';

export default class Gcs implements IStorageAdapter {
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
          cacheControl: 'public, max-age=31536000'
        }
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
      private_key: this.input.private_key
    };

    this.bucketName = this.input.bucket;

    this.storageClient = new Storage(options);
  }

  public async test(): Promise<boolean> {
    try {
      const tempFile = path.join(process.cwd(), 'temp.txt');
      const createStream = fs.createWriteStream(tempFile);
      createStream.end();
      await this.fileCreate('/nc-test-file.txt', {
        path: tempFile,
        mimetype: '',
        originalname: 'temp.txt',
        size: ''
      });
      fs.unlinkSync(tempFile);
      return true;
    } catch (e) {
      throw e;
    }
  }
}
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
