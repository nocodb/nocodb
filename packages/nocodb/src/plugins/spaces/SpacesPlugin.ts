import Spaces from './Spaces';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class SpacesPlugin extends XcStoragePlugin {
  private static storageAdapter: Spaces;

  public getAdapter(): IStorageAdapterV2 {
    return SpacesPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    SpacesPlugin.storageAdapter = new Spaces(config);
    await SpacesPlugin.storageAdapter.init();
  }
}

export default SpacesPlugin;
