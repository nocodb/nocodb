import IStorageAdapter from './IStorageAdapter';

export default interface IStorageAdapterV2 extends IStorageAdapter {
  fileCreateByUrl(
    destPath: string,
    url: string,
    fileMeta?: FileMeta
  ): Promise<any>;
}

interface FileMeta {
  fileName?: string;
  mimetype?: string;
  size?: number | string;
}
