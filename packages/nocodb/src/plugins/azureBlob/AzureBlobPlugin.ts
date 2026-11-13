import AzureBlob from './AzureBlob';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class AzureBlobPlugin extends XcStoragePlugin {
  private static storageAdapter: AzureBlob;

  public getAdapter(): IStorageAdapterV2 {
    return AzureBlobPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    AzureBlobPlugin.storageAdapter = new AzureBlob(config);
    await AzureBlobPlugin.storageAdapter.init();
  }
}

export default AzureBlobPlugin;
