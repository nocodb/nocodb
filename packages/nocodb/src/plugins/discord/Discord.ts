import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';

export default class Discord implements IWebhookNotificationAdapter {
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(content: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels || []) {
      try {
        return await axios.post(webhook_url, {
          content,
          httpAgent: useAgent(webhook_url),
          httpsAgent: useAgent(webhook_url),
        });
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  }
}
