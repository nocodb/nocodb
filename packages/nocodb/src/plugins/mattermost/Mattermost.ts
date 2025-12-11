import { Logger } from '@nestjs/common';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';

export default class Mattermost implements IWebhookNotificationAdapter {
  private logger = new Logger(Mattermost.name);
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels || []) {
      try {
        return await axios.post(webhook_url, {
          text,
          httpAgent: useAgent(webhook_url, {
            stopPortScanningByUrlRedirection: true,
          }),
          httpsAgent: useAgent(webhook_url, {
            stopPortScanningByUrlRedirection: true,
          }),
        });
      } catch (e) {
        if (e.response) {
          this.logger.error({
            message: e.message,
            status: e.response.status,
            data: e.response.data,
          });
        } else {
          this.logger.error(e.message, e.stack);
        }
        throw e;
      }
    }
  }
}
