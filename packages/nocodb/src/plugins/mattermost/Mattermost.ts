import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';
import { validateAndResolveURL } from '~/utils/securityUtils';

export default class Mattermost implements IWebhookNotificationAdapter {
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels || []) {
      try {
        const finalURL = await validateAndResolveURL(webhook_url);
        return await axios.post(finalURL, {
          text,
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
