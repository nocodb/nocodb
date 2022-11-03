import IEmailAdapter from './IEmailAdapter';
import XcPlugin from './XcPlugin';

abstract class XcEmailPlugin extends XcPlugin {
  abstract getAdapter(): IEmailAdapter;
}

export default XcEmailPlugin;
