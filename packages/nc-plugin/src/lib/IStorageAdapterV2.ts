import IStorageAdapter from './IStorageAdapter';
import { Readable } from 'stream';

export default interface IStorageAdapterV2 extends IStorageAdapter {
  fileCreateByUrl(
    destPath: string,
    url: string,
    fileMeta?: FileMeta
  ): Promise<any>;
  fileCreateByStream(destPath: string, readStream: Readable): Promise<void>;
  fileReadByStream(key: string): Promise<Readable>;
  getDirectoryList(path: string): Promise<string[]>;
}

interface FileMeta {
  fileName?: string;
  mimetype?: string;
  size?: number | string;
}
