// @ts-ignore
import nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';

import IEmailAdapter, { XcEmail } from '../../../../../interface/IEmailAdapter';

export default // @ts-ignore
class SMTP implements IEmailAdapter {
  private transporter: Mail;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init(): Promise<any> {
    const config = {
      host: this.input?.host,
      port: parseInt(this.input?.port, 10),
      secure: this.input?.secure === 'true',
      ignoreTLS:
        typeof this.input?.ignoreTLS === 'boolean'
          ? this.input?.ignoreTLS
          : this.input?.ignoreTLS === 'true',
      auth: {
        user: this.input?.username,
        pass: this.input?.password,
      },
    };
    this.transporter = nodemailer.createTransport(config);
  }

  public async mailSend(mail: XcEmail): Promise<any> {
    if (this.transporter) {
      await this.transporter.sendMail({ ...mail, from: this.input.from });
    }
  }

  public async test(email): Promise<boolean> {
    try {
      this.mailSend({
        to: email,
        subject: 'Test email',
        html: 'Test email',
      } as any);
      return true;
    } catch (e) {
      throw e;
    }
  }
}
