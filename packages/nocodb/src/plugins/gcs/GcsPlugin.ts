import Gcs from './Gcs';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class GcsPlugin extends XcStoragePlugin {
  private static storageAdapter: Gcs;

  public getAdapter(): IStorageAdapterV2 {
    return GcsPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    GcsPlugin.storageAdapter = new Gcs(config);
    await GcsPlugin.storageAdapter.init();
  }
}

export default GcsPlugin;
