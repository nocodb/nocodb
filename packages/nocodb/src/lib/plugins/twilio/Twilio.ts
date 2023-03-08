import type { IWebhookNotificationAdapter } from 'nc-plugin';
import twilio from 'twilio';

export default class Twilio implements IWebhookNotificationAdapter {
  private input: any;
  private client: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init() {
    this.client = twilio(this.input.sid, this.input.token);
  }

  public async sendMessage(content: string, payload: any): Promise<any> {
    for (const num of payload?.to?.split(/\s*?,\s*?/)) {
      try {
        await this.client.messages.create({
          body: content,
          from: this.input.from,
          to: num,
        });
      } catch (e) {
        console.log(e);
      }
    }
  }
}
