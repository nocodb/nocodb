import type { IStorageAdapterV2 } from 'nc-plugin';
import { XcStoragePlugin } from 'nc-plugin';

import UpoCloud from './UpoCloud';

class UpCloudPlugin extends XcStoragePlugin {
  private static storageAdapter: UpoCloud;

  public getAdapter(): IStorageAdapterV2 {
    return UpCloudPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    UpCloudPlugin.storageAdapter = new UpoCloud(config);
    await UpCloudPlugin.storageAdapter.init();
  }
}

export default UpCloudPlugin;
