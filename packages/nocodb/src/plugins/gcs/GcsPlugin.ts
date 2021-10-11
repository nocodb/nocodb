import { IStorageAdapter, XcStoragePlugin } from 'nc-plugin';

import Gcs from './Gcs';

class GcsPlugin extends XcStoragePlugin {
  private static storageAdapter: Gcs;

  public getAdapter(): IStorageAdapter {
    return GcsPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    GcsPlugin.storageAdapter = new Gcs(config);
    await GcsPlugin.storageAdapter.init();
  }
}

export default GcsPlugin;
