import { XcStoragePlugin } from 'nc-plugin';
import Gcs from './Gcs';
import type { IStorageAdapterV2 } from 'nc-plugin';

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
