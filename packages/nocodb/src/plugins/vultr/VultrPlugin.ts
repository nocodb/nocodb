import { IStorageAdapter, XcStoragePlugin } from 'nc-plugin';

import Vultr from './Vultr';

class VultrPlugin extends XcStoragePlugin {
  private static storageAdapter: Vultr;

  public getAdapter(): IStorageAdapter {
    return VultrPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    VultrPlugin.storageAdapter = new Vultr(config);
    await VultrPlugin.storageAdapter.init();
  }
}

export default VultrPlugin;
