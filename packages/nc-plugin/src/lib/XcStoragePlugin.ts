import IStorageAdapter from './IStorageAdapter';
import XcPlugin from './XcPlugin';

abstract class XcStoragePlugin extends XcPlugin {
  abstract getAdapter(): IStorageAdapter;
}

export default XcStoragePlugin;
