import type { IWebhookNotificationAdapter } from 'nc-plugin';
import { XcWebhookNotificationPlugin } from 'nc-plugin';

import Mattermost from './Mattermost';

class MattermostPlugin extends XcWebhookNotificationPlugin {
  private static notificationAdapter: Mattermost;

  public getAdapter(): IWebhookNotificationAdapter {
    return MattermostPlugin.notificationAdapter;
  }

  public async init(_config: any): Promise<any> {
    MattermostPlugin.notificationAdapter = new Mattermost();
    await MattermostPlugin.notificationAdapter.init();
  }
}

export default MattermostPlugin;
