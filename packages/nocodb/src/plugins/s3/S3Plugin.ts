import S3 from './S3';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class S3Plugin extends XcStoragePlugin {
  private static storageAdapter: S3;

  public getAdapter(): IStorageAdapterV2 {
    return S3Plugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    S3Plugin.storageAdapter = new S3(config);
    await S3Plugin.storageAdapter.init();
  }
}

export default S3Plugin;
