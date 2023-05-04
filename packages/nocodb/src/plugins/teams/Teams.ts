import axios from 'axios';
import type { IWebhookNotificationAdapter } from 'nc-plugin';

export default class Teams implements IWebhookNotificationAdapter {
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(Text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels) {
      try {
        return await axios.post(webhook_url, {
          Text,
        });
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  }
}
