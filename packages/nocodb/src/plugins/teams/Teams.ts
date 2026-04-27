import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import { Logger } from '@nestjs/common';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';

export default class Teams implements IWebhookNotificationAdapter {
  private readonly logger = new Logger(Teams.name);
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(Text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels || []) {
      try {
        return await axios.post(
          webhook_url,
          { Text },
          {
            httpAgent: useAgent(webhook_url),
            httpsAgent: useAgent(webhook_url),
          },
        );
      } catch (e) {
        this.logger.error('Teams webhook sendMessage error', e);
        throw e;
      }
    }
  }
}
