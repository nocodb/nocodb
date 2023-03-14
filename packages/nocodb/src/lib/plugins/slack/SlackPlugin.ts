import { XcWebhookNotificationPlugin } from 'nc-plugin';
import Slack from './Slack';
import type { IWebhookNotificationAdapter } from 'nc-plugin';

class SlackPlugin extends XcWebhookNotificationPlugin {
  private static notificationAdapter: Slack;

  public getAdapter(): IWebhookNotificationAdapter {
    return SlackPlugin.notificationAdapter;
  }

  public async init(_config: any): Promise<any> {
    SlackPlugin.notificationAdapter = new Slack();
    await SlackPlugin.notificationAdapter.init();
  }
}

export default SlackPlugin;
