import { XcStoragePlugin } from 'nc-plugin';
import OvhCloud from './OvhCloud';
import type { IStorageAdapterV2 } from 'nc-plugin';

class OvhCloudPlugin extends XcStoragePlugin {
  private static storageAdapter: OvhCloud;

  public getAdapter(): IStorageAdapterV2 {
    return OvhCloudPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    OvhCloudPlugin.storageAdapter = new OvhCloud(config);
    await OvhCloudPlugin.storageAdapter.init();
  }
}

export default OvhCloudPlugin;
