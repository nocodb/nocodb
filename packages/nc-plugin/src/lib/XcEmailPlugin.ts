import XcPlugin from "./XcPlugin";
import IEmailAdapter from "./IEmailAdapter";

abstract class XcEmailPlugin extends XcPlugin{

  abstract getAdapter():IEmailAdapter

}


export default XcEmailPlugin;
