import nodemailer from 'nodemailer';
import type { IEmailAdapter } from 'nc-plugin';
import type Mail from 'nodemailer/lib/mailer';
import type { XcEmail } from '~/interface/IEmailAdapter';

export default class SMTP implements IEmailAdapter {
  private transporter: Mail;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init(): Promise<any> {
    const config = {
      host: this.input?.host,
      port: parseInt(this.input?.port, 10),
      secure:
        typeof this.input?.secure === 'boolean'
          ? this.input?.secure
          : this.input?.secure === 'true',
      ignoreTLS:
        typeof this.input?.ignoreTLS === 'boolean'
          ? this.input?.ignoreTLS
          : this.input?.ignoreTLS === 'true',
      auth: {
        user: this.input?.username,
        pass: this.input?.password,
      },
      tls: {
        rejectUnauthorized: this.input?.rejectUnauthorized,
      },
    };

    this.transporter = nodemailer.createTransport(config);
  }

  public async mailSend(mail: XcEmail): Promise<any> {
    if (this.transporter) {
      await this.transporter.sendMail({ ...mail, from: this.input.from });
    }
  }

  public async test(): Promise<boolean> {
    try {
      await this.mailSend({
        to: this.input.from,
        subject: 'Test email',
        html: 'Test email',
      } as any);
      return true;
    } catch (e) {
      console.log('SMTP test error :: ', e);
      throw new Error(
        'SMTP test failed, please check server log for more details.',
      );
    }
  }
}
