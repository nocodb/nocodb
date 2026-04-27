import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import { Logger } from '@nestjs/common';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';

export default class Slack implements IWebhookNotificationAdapter {
  private readonly logger = new Logger(Slack.name);

  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels || []) {
      try {
        return await axios.post(
          webhook_url,
          { text },
          {
            httpAgent: useAgent(webhook_url),
            httpsAgent: useAgent(webhook_url),
          },
        );
      } catch (e) {
        this.logger.error('Failed to send Slack webhook message', e);
        throw e;
      }
    }
  }
}
