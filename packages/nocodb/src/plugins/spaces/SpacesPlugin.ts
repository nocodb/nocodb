import { IStorageAdapter, XcStoragePlugin } from 'nc-plugin';

import Spaces from './Spaces';

class SpacesPlugin extends XcStoragePlugin {
  private static storageAdapter: Spaces;

  public getAdapter(): IStorageAdapter {
    return SpacesPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    SpacesPlugin.storageAdapter = new Spaces(config);
    await SpacesPlugin.storageAdapter.init();
  }
}

export default SpacesPlugin;
