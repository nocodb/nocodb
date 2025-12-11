import { Logger } from '@nestjs/common';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';

export default class Teams implements IWebhookNotificationAdapter {
  private logger = new Logger(Teams.name);
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(Text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels || []) {
      try {
        return await axios.post(webhook_url, {
          Text,
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
