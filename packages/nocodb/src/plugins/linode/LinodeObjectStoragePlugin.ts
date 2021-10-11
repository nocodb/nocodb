import { IStorageAdapter, XcStoragePlugin } from 'nc-plugin';

import LinodeObjectStorage from './LinodeObjectStorage';

class LinodeObjectStoragePlugin extends XcStoragePlugin {
  private static storageAdapter: LinodeObjectStorage;

  public getAdapter(): IStorageAdapter {
    return LinodeObjectStoragePlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    LinodeObjectStoragePlugin.storageAdapter = new LinodeObjectStorage(config);
    await LinodeObjectStoragePlugin.storageAdapter.init();
  }
}

export default LinodeObjectStoragePlugin;
