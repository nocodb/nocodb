import fs from 'fs';
import path from 'path';

import AWS from 'aws-sdk';
import slash from 'slash';
import { IStorageAdapterV2, XcFile } from 'nc-plugin';
import request from 'request';

export default class S3 implements IStorageAdapterV2 {
  private s3Client: AWS.S3;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  async fileCreate(key: string, file: XcFile, isPublic = false): Promise<any> {
    const uploadParams: any = {
      ACL: isPublic ? 'public-read' : 'private'
    };
    return new Promise((resolve, reject) => {
      // Configure the file stream and obtain the upload parameters
      const fileStream = fs.createReadStream(file.path);
      fileStream.on('error', (err) => {
        console.log('File Error', err);
        reject(err);
      });

      uploadParams.Body = fileStream;
      uploadParams.Key = key;

      // call S3 to retrieve upload file to specified bucket
      this.s3Client.upload(uploadParams, (err, data) => {
        if (err) {
          console.log('Error', err);
          reject(err);
        }
        if (data) {
          resolve(data.Location);
        }
      });
    });
  }
  async fileCreateByUrl(key: string, url: string): Promise<any> {
    const uploadParams: any = {
      ACL: 'public-read',
    };
    return new Promise((resolve, reject) => {
      // Configure the file stream and obtain the upload parameters
      request(
        {
          url: url,
          encoding: null,
        },
        (err, _, body) => {
          if (err) return reject(err);

          uploadParams.Body = body;
          uploadParams.Key = key;

          // call S3 to retrieve upload file to specified bucket
          this.s3Client.upload(uploadParams, (err1, data) => {
            if (err) {
              console.log('Error', err);
              reject(err1);
            }
            if (data) {
              resolve(data.Location);
            }
          });
        }
      );
    });
  }

  private async upload(uploadParams): Promise<any> {
    return new Promise((resolve, reject) => {
      this.s3Client.upload(uploadParams, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data.Location);
        }
      });
    });
  }

  /**
   * Generates a signed S3 URL for the given file.
   * @param {string} file - the file to generate a signed URL for.
   * @returns {string} The signed S3 URL.
   */
  public getSignedUrl(key, expires = 900) {
    const signedUrl = this.s3Client.getSignedUrl('getObject', {
      Key: key,
      Expires: expires
    });
    return signedUrl;
  }

  public async fileDelete(_path: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async fileRead(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.s3Client.getObject({ Key: key } as any, (err, data) => {
        if (err) {
          return reject(err);
        }
        if (!data?.Body) {
          return reject(data);
        }
        return resolve(data.Body);
      });
    });
  }

  /**
   * Writes the given data to the given file.
   * @param {string} location - the file location
   * @param {string} fileName - file name
   * @param {string} data - Data to write
   * @returns None
   */
  public async fileWrite({
    location,
    fileName,
    content,
    contentType
  }): Promise<any> {
    const buf = Buffer.from(content);
    return await this.upload({
      Key: slash(path.join(location, fileName)),
      Body: buf,
      ContentEncoding: 'base64',
      ContentType: contentType
    });
  }

  public async init(): Promise<any> {
    // const s3Options: any = {
    //   params: {Bucket: process.env.NC_S3_BUCKET},
    //   region: process.env.NC_S3_REGION
    // };
    //
    // s3Options.accessKeyId = process.env.NC_S3_KEY;
    // s3Options.secretAccessKey = process.env.NC_S3_SECRET;

    const s3Options: any = {
      params: { Bucket: this.input.bucket },
      region: this.input.region,
    };

    s3Options.accessKeyId = this.input.access_key;
    s3Options.secretAccessKey = this.input.access_secret;

    this.s3Client = new AWS.S3(s3Options);
  }

  public async test(): Promise<boolean> {
    try {
      const tempFile = path.join(process.cwd(), 'temp.txt');
      const createStream = fs.createWriteStream(tempFile);
      createStream.end();
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
