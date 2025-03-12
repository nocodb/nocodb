import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';

export default class Teams implements IWebhookNotificationAdapter {
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(Text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels || []) {
      try {
        const finalURL = await validateAndResolveURL(webhook_url);
        return await axios.post(finalURL, {
          Text,
          httpAgent: useAgent(finalURL, {
            stopPortScanningByUrlRedirection: true,
          }),
          httpsAgent: useAgent(finalURL, {
            stopPortScanningByUrlRedirection: true,
          }),
        });
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  }
}
