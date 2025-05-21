import XcPlugin from './XcPlugin';
import type IEmailAdapter from './IEmailAdapter';

abstract class XcEmailPlugin extends XcPlugin {
  abstract getAdapter(): IEmailAdapter;
}

export default XcEmailPlugin;
