import twilio from 'twilio';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';

export default class TwilioWhatsapp implements IWebhookNotificationAdapter {
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
          from: `whatsapp:${this.input.from}`,
          to: `whatsapp:${num}`,
        });
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  }
}
