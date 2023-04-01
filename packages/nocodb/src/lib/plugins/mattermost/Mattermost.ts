import axios from 'axios';
import type { IWebhookNotificationAdapter } from 'nc-plugin';

export default class Mattermost implements IWebhookNotificationAdapter {
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels) {
      try {
        await axios.post(webhook_url, {
          text,
        });
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  }
}
