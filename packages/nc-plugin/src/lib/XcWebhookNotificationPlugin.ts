import { IWebhookNotificationAdapter } from '../index';

import XcPlugin from './XcPlugin';

abstract class XcStoragePlugin extends XcPlugin {
  abstract getAdapter(): IWebhookNotificationAdapter;
}

export default XcStoragePlugin;
