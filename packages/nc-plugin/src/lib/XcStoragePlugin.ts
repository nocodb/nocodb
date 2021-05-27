import XcPlugin from "./XcPlugin";
import IStorageAdapter from "./IStorageAdapter";

abstract class XcStoragePlugin extends XcPlugin {

  abstract getAdapter(): IStorageAdapter

}


export default XcStoragePlugin;
