import { IStorageAdapter, XcStoragePlugin } from 'nc-plugin';

import ScalewayObjectStorage from './ScalewayObjectStorage';

class ScalewayObjectStoragePlugin extends XcStoragePlugin {
  private static storageAdapter: ScalewayObjectStorage;

  public getAdapter(): IStorageAdapter {
    return ScalewayObjectStoragePlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    ScalewayObjectStoragePlugin.storageAdapter = new ScalewayObjectStorage(
      config
    );
    await ScalewayObjectStoragePlugin.storageAdapter.init();
  }
}

export default ScalewayObjectStoragePlugin;

/**
 * @copyright Copyright (c) 2021, Bhanu P Chaudhary <bhanu423@gmail.com>
 *
 * @author Bhanu P Chaudhary <bhanu423@gmail.com>
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
