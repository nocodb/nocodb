import { IStorageAdapter, XcStoragePlugin } from 'nc-plugin';

import Backblaze from './Backblaze';

class BackblazePlugin extends XcStoragePlugin {
  private static storageAdapter: Backblaze;

  public getAdapter(): IStorageAdapter {
    return BackblazePlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    BackblazePlugin.storageAdapter = new Backblaze(config);
    await BackblazePlugin.storageAdapter.init();
  }
}

export default BackblazePlugin;
