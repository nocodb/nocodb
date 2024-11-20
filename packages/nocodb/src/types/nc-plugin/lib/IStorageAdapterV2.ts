import type { Readable } from 'stream';

import type IStorageAdapter from './IStorageAdapter';

/*
  #ref: https://github.com/nocodb/nocodb/pull/5608
    fileCreateByStream: write file from a readable stream to the storage
    fileReadByStream: read file from the storage to a readable stream
    getDirectoryList: get files available in a directory

    These methods are added to support export/import without buffering all the data in memory.
    The methods are only available for Local storage adapter for now, and will be implemented for other adapters later.
    The methods are not used in current codebase, but will be used in future.
*/

export default interface IStorageAdapterV2<
  FileCreateByUrlOptions extends {
    fetchOptions?: {
      buffer?: boolean;
    };
  } = {
    fetchOptions?: {
      buffer?: boolean;
    };
  },
> extends IStorageAdapter {
  name: string;
  fileCreateByUrl(
    destPath: string,
    url: string,
    options?: FileCreateByUrlOptions,
  ): Promise<any>;
  fileCreateByStream(
    destPath: string,
    readStream: Readable,
  ): Promise<string | null>;
  fileReadByStream(
    key: string,
    options?: { encoding?: string },
  ): Promise<Readable>;
  getDirectoryList(path: string): Promise<string[]>;
  scanFiles(_globPattern: string): Promise<Readable>;
}
