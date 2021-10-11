import { IStorageAdapter, XcStoragePlugin } from 'nc-plugin';

import Minio from './Minio';

class MinioPlugin extends XcStoragePlugin {
  private static storageAdapter: Minio;

  public getAdapter(): IStorageAdapter {
    return MinioPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    MinioPlugin.storageAdapter = new Minio(config);
    await MinioPlugin.storageAdapter.init();
  }
}

export default MinioPlugin;
