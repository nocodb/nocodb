import fs from 'fs';
import path from 'path';

import mkdirp from 'mkdirp';

import { IStorageAdapterV2, XcFile } from 'nc-plugin';
import NcConfigFactory from '../../../../utils/NcConfigFactory';

import request from 'request';

export default class Local implements IStorageAdapterV2 {
  constructor() {}

  public async fileCreate(
    key: string,
    file: XcFile,
    _isPublic?: boolean
  ): Promise<any> {
    const destPath = path.join(NcConfigFactory.getToolDir(), ...key.split('/'));
    try {
      mkdirp.sync(path.dirname(destPath));
      const data = await fs.readFileSync(file.path);
      await fs.writeFileSync(destPath, data);
      fs.unlinkSync(file.path);
      // await fs.promises.rename(file.path, destPath);
    } catch (e) {
      throw e;
    }
  }

  async fileCreateByUrl(key: string, url: string): Promise<any> {
    const destPath = path.join(NcConfigFactory.getToolDir(), ...key.split('/'));
    return new Promise((resolve, reject) => {
      mkdirp.sync(path.dirname(destPath));
      const file = fs.createWriteStream(destPath);
      const sendReq = request.get(url);

      // verify response code
      sendReq.on('response', (response) => {
        if (response.statusCode !== 200) {
          return reject('Response status was ' + response.statusCode);
        }

        sendReq.pipe(file);
      });

      // close() is async, call cb after close completes
      file.on('finish', () => {
        file.close((err) => {
          if (err) {
            return reject(err);
          }
          resolve(null);
        });
      });

      // check for request errors
      sendReq.on('error', (err) => {
        fs.unlink(destPath, () => reject(err.message)); // delete the (partial) file and then return the error
      });

      file.on('error', (err) => {
        // Handle errors
        fs.unlink(destPath, () => reject(err.message)); // delete the (partial) file and then return the error
      });
    });
  }

  // todo: implement
  fileDelete(_path: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async fileRead(filePath: string): Promise<any> {
    try {
      const fileData = await fs.promises.readFile(
        path.join(NcConfigFactory.getToolDir(), ...filePath.split('/'))
      );
      return fileData;
    } catch (e) {
      throw e;
    }
  }

  init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  test(): Promise<boolean> {
    return Promise.resolve(false);
  }

  /**
   * Writes the given data to the given file.
   * @param {string} location - the file location
   * @param {string} fileName - file name
   * @param {string} data - Data to write
   * @returns None
   */
  public async fileWrite({ location, fileName, content }) {
    const absouluteLocation = path.join(NcConfigFactory.getToolDir(), location);
    mkdirp.sync(absouluteLocation);
    return fs.writeFileSync(
      path.join(absouluteLocation, fileName),
      content,
      'utf-8'
    );
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
