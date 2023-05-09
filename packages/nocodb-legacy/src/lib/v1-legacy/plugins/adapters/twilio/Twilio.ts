import twilio from 'twilio';

export default class Twilio {
  private static instance: Twilio;

  private input: any;
  private client: any;

  constructor(input: any) {
    this.input = input;
  }

  async init() {
    this.client = twilio(this.input.sid, this.input.token);
  }

  // tslint:disable-next-line:typedef
  public static create(config: any, overwrite = false): Twilio {
    if (this.instance && !overwrite) {
      return this.instance;
    }

    if (config) {
      const input = JSON.parse(config.input);
      this.instance = new Twilio(input);
    }
    return this.instance;
  }

  public async sendMessage(content: string, numbers: string[]): Promise<any> {
    for (const num of numbers) {
      try {
        await this.client.messages.create({
          body: content,
          from: this.input.from,
          to: num,
        });
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  }
}
