import { IStorageAdapter, XcStoragePlugin } from 'nc-plugin';

import OvhCloud from './OvhCloud';

class OvhCloudPlugin extends XcStoragePlugin {
  private static storageAdapter: OvhCloud;

  public getAdapter(): IStorageAdapter {
    return OvhCloudPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    OvhCloudPlugin.storageAdapter = new OvhCloud(config);
    await OvhCloudPlugin.storageAdapter.init();
  }
}

export default OvhCloudPlugin;
