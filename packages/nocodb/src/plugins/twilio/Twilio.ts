import { Logger } from '@nestjs/common';
import twilio from 'twilio';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';

export default class Twilio implements IWebhookNotificationAdapter {
  private logger = new Logger(Twilio.name);
  private input: any;
  private client: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init() {
    this.client = twilio(this.input.sid, this.input.token);
  }

  public async sendMessage(content: string, payload: any): Promise<any> {
    for (const num of payload?.to?.split(/\s*?,\s*?/) || []) {
      try {
        await this.client.messages.create({
          body: content,
          from: this.input.from,
          to: num,
        });
      } catch (e) {
        this.logger.error({
          message: e.message,
          code: e.code,
          status: e.status,
          moreInfo: e.moreInfo,
        });
        throw e;
      }
    }
  }
}
