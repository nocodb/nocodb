import { XcStoragePlugin } from 'nc-plugin';
import LinodeObjectStorage from './LinodeObjectStorage';
import type { IStorageAdapterV2 } from 'nc-plugin';

class LinodeObjectStoragePlugin extends XcStoragePlugin {
  private static storageAdapter: LinodeObjectStorage;

  public getAdapter(): IStorageAdapterV2 {
    return LinodeObjectStoragePlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    LinodeObjectStoragePlugin.storageAdapter = new LinodeObjectStorage(config);
    await LinodeObjectStoragePlugin.storageAdapter.init();
  }
}

export default LinodeObjectStoragePlugin;
