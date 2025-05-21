import Twilio from './Twilio';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';
import { XcWebhookNotificationPlugin } from '~/types/nc-plugin';

class TwilioPlugin extends XcWebhookNotificationPlugin {
  private static notificationAdapter: Twilio;

  public getAdapter(): IWebhookNotificationAdapter {
    return TwilioPlugin.notificationAdapter;
  }

  public async init(config: any): Promise<any> {
    TwilioPlugin.notificationAdapter = new Twilio(config);
    await TwilioPlugin.notificationAdapter.init();
  }
}

export default TwilioPlugin;
