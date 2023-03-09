import { XcStoragePlugin } from 'nc-plugin';
import Backblaze from './Backblaze';
import type { IStorageAdapterV2 } from 'nc-plugin';

class BackblazePlugin extends XcStoragePlugin {
  private static storageAdapter: Backblaze;

  public getAdapter(): IStorageAdapterV2 {
    return BackblazePlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    BackblazePlugin.storageAdapter = new Backblaze(config);
    await BackblazePlugin.storageAdapter.init();
  }
}

export default BackblazePlugin;
