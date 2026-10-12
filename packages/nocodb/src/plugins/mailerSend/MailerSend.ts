import MailerSend, { Attachment, EmailParams, Recipient } from 'mailersend';
import type { IEmailAdapter } from '~/types/nc-plugin';
import type { XcEmail } from '~/types/nc-plugin/lib/IEmailAdapter';
import { NcError } from '~/helpers/ncError';

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
      // White-label sender-name override (falls back to the plugin's from_name).
      .setFromName(mail.fromName || this.input.from_name)
      .setRecipients(recipients)
      .setSubject(mail.subject)
      .setHtml(mail.html)
      .setText(mail.text);

    const attachments = (mail.attachments ?? [])
      .filter((a) => a.content !== undefined && a.content !== null)
      .map(
        (a) =>
          new Attachment(
            Buffer.isBuffer(a.content)
              ? a.content.toString('base64')
              : Buffer.from(
                  String(a.content),
                  (a.encoding as BufferEncoding) || 'utf8',
                ).toString('base64'),
            a.filename || 'attachment',
          ),
      );
    if (attachments.length) {
      emailParams.setAttachments(attachments);
    }

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
      NcError._.pluginTestError(e?.message);
    }
  }
}
