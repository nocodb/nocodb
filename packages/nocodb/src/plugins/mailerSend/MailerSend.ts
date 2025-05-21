import MailerSend, { EmailParams, Recipient } from 'mailersend';
import type { IEmailAdapter } from '~/types/nc-plugin';
import type { XcEmail } from '~/interface/IEmailAdapter';

export default class Mailer implements IEmailAdapter {
  private mailersend: MailerSend;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init(): Promise<any> {
    this.mailersend = new MailerSend({
      api_key: this.input?.api_key,
    });
  }

  public async mailSend(mail: XcEmail): Promise<any> {
    const recipients = [new Recipient(mail.to)];

    const emailParams = new EmailParams()
      .setFrom(this.input.from)
      .setFromName(this.input.from_name)
      .setRecipients(recipients)
      .setSubject(mail.subject)
      .setHtml(mail.html)
      .setText(mail.text);

    const res = await this.mailersend.send(emailParams);
    if (res.status === 401) {
      throw new Error(res.status);
    }
  }

  public async test(email): Promise<boolean> {
    try {
      await this.mailSend({
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
