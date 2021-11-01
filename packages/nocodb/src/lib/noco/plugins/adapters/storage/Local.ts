import fs from 'fs';
import path from 'path';

import mkdirp from 'mkdirp';

import IStorageAdapter, {
  XcFile
} from '../../../../../interface/IStorageAdapter';
import NcConfigFactory from '../../../../utils/NcConfigFactory';

export default class Local implements IStorageAdapter {
  constructor() {}

  public async fileCreate(key: string, file: XcFile): Promise<any> {
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
