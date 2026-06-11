import ScalewayObjectStorage from './ScalewayObjectStorage';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class ScalewayObjectStoragePlugin extends XcStoragePlugin {
  private static storageAdapter: ScalewayObjectStorage;
  public async init(config: any): Promise<any> {
    ScalewayObjectStoragePlugin.storageAdapter = new ScalewayObjectStorage(
      config,
    );
    await ScalewayObjectStoragePlugin.storageAdapter.init();
  }
  public getAdapter(): IStorageAdapterV2 {
    return ScalewayObjectStoragePlugin.storageAdapter;
  }
}

export default ScalewayObjectStoragePlugin;
