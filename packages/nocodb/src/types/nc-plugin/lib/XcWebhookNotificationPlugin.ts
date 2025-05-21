import XcPlugin from './XcPlugin';
import type { IWebhookNotificationAdapter } from '../index';

abstract class XcStoragePlugin extends XcPlugin {
  abstract getAdapter(): IWebhookNotificationAdapter;
}

export default XcStoragePlugin;
