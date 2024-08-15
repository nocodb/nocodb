import XcPlugin from './XcPlugin';
import type IStorageAdapter from './IStorageAdapter';

abstract class XcStoragePlugin extends XcPlugin {
  abstract getAdapter(): IStorageAdapter;
}

export default XcStoragePlugin;
