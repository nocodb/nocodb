import { Readable } from 'stream';

import IStorageAdapter from './IStorageAdapter';

/*
  #ref: https://github.com/nocodb/nocodb/pull/5608
    fileCreateByStream: write file from a readable stream to the storage
    fileReadByStream: read file from the storage to a readable stream
    getDirectoryList: get files available in a directory

    These methods are added to support export/import without buffering all the data in memory.
    The methods are only available for Local storage adapter for now, and will be implemented for other adapters later.
    The methods are not used in current codebase, but will be used in future.
*/

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
