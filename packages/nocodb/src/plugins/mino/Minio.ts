import fs from "fs";
import path from "path";

import {Client as MinioClient} from "minio";
import {IStorageAdapter, XcFile} from "nc-plugin";

export default class Minio implements IStorageAdapter {


  private minioClient: MinioClient;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }


  async fileCreate(key: string, file: XcFile): Promise<any> {

    return new Promise((resolve, reject) => {
      // Configure the file stream and obtain the upload parameters
      const fileStream = fs.createReadStream(file.path);
      fileStream.on('error', (err) => {
        console.log('File Error', err);
        reject(err);
      });

      // uploadParams.Body = fileStream;
      // uploadParams.Key = key;
      const metaData = {
        'Content-Type': file.mimetype,
        // 'X-Amz-Meta-Testing': 1234,
        // 'example': 5678
      }
      // call S3 to retrieve upload file to specified bucket
      this.minioClient.putObject(this.input?.bucket, key, fileStream,metaData).then(()=>{
        resolve(`http${this.input.useSSL ? 's' : ''}://${this.input.endPoint}:${this.input.port}/${this.input.bucket}/${key}`)
      }).catch(reject)
    });
  }

  public async fileDelete(_path: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async fileRead(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.minioClient.getObject(this.input.bucket, key, (err, data) => {
        if (err) {
          return reject(err);
        }
        if (!data) {
          return reject(data);
        }
        return resolve(data);
      });
    });
  }

  public async init(): Promise<any> {
    // todo:  update in ui(checkbox and number field)
    this.input.port = +this.input.port || 9000;
    this.input.useSSL = this.input.useSSL ==='true';
    this.input.accessKey = this.input.access_key;
    this.input.secretKey = this.input.access_secret;

    this.minioClient = new MinioClient(this.input);
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
