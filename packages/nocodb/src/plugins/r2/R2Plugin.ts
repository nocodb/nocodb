import R2 from './R2';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class R2Plugin extends XcStoragePlugin {
  private static storageAdapter: R2;

  public getAdapter(): IStorageAdapterV2 {
    return R2Plugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    R2Plugin.storageAdapter = new R2(config);
    await R2Plugin.storageAdapter.init();
  }
}

export default R2Plugin;
