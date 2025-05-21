import Minio from './Minio';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import { XcStoragePlugin } from '~/types/nc-plugin';

class MinioPlugin extends XcStoragePlugin {
  private static storageAdapter: Minio;

  public getAdapter(): IStorageAdapterV2 {
    return MinioPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    MinioPlugin.storageAdapter = new Minio(config);
    await MinioPlugin.storageAdapter.init();
  }
}

export default MinioPlugin;
