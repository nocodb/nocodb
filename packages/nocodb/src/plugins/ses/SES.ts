import nodemailer from 'nodemailer';

import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { IEmailAdapter } from '~/types/nc-plugin';
import type Mail from 'nodemailer/lib/mailer';
import type { XcEmail } from '~/interface/IEmailAdapter';
import { NcError } from '~/helpers/ncError';
import { emailAddressOnly } from '~/helpers/emailFrom';

export default class SES implements IEmailAdapter {
  private transporter: Mail;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init(): Promise<any> {
    const sesClient = new SESv2Client({
      region: this.input.region,
      credentials: {
        accessKeyId: this.input.access_key,
        secretAccessKey: this.input.access_secret,
      },
    });

    this.transporter = nodemailer.createTransport({
      SES: {
        sesClient,
        SendEmailCommand,
      },
    });
  }

  public async mailSend(mail: XcEmail): Promise<any> {
    if (this.transporter) {
      const { fromName, ...rest } = mail;
      // Override only the display name (keep the verified SES sender address)
      // when a sender name is supplied (white-label); otherwise unchanged.
      const from = fromName
        ? { name: fromName, address: emailAddressOnly(this.input.from) }
        : this.input.from;
      this.transporter.sendMail(
        { ...rest, from },
        (err, info) => {
          if (err) {
            console.log(err);
          } else {
            console.log('Message sent: ' + info.response);
          }
        },
      );
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
      NcError.pluginTestError(e?.message);
    }
  }
}
