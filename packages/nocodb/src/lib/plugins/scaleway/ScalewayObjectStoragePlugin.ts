import { IStorageAdapterV2, XcStoragePlugin } from 'nc-plugin';

import ScalewayObjectStorage from './ScalewayObjectStorage';

class ScalewayObjectStoragePlugin extends XcStoragePlugin {
  private static storageAdapter: ScalewayObjectStorage;
  public async init(config: any): Promise<any> {
    ScalewayObjectStoragePlugin.storageAdapter = new ScalewayObjectStorage(
      config
    );
    await ScalewayObjectStoragePlugin.storageAdapter.init();
  }
  public getAdapter(): IStorageAdapterV2 {
    return ScalewayObjectStoragePlugin.storageAdapter;
  }
}

export default ScalewayObjectStoragePlugin;
