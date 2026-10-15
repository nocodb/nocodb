import MailerSend, { EmailParams, Recipient } from 'mailersend';
import type { IEmailAdapter, XcEmail } from '~/types/nc-plugin';
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
    const recipients = toRecipients(mail.to);

    const emailParams = new EmailParams()
      .setFrom(this.input.from)
      // White-label sender-name override (falls back to the plugin's from_name).
      .setFromName(mail.fromName || this.input.from_name)
      .setRecipients(recipients)
      .setSubject(mail.subject)
      .setHtml(mail.html)
      .setText(mail.text);
    if (mail.cc) emailParams.setCc(toRecipients(mail.cc));
    if (mail.bcc) emailParams.setBcc(toRecipients(mail.bcc));

    // The SDK predates inline parts; the API reads `id` as the Content-ID for `cid:` references.
    const attachments = (mail.attachments ?? []).map((attachment) => {
      if (attachment.content === undefined || attachment.content === null) {
        // MailerSend takes bytes only; fetching a link here would bypass the SSRF-filtered agents.
        throw new Error(
          `MailerSend can't attach "${
            attachment.filename || 'file'
          }" by link or path; pass its content instead`,
        );
      }
      const content = Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(
            attachment.content,
            (attachment.encoding as BufferEncoding) || 'utf8',
          );
      return {
        content: content.toString('base64'),
        filename: attachment.filename || 'attachment',
        disposition: attachment.cid ? 'inline' : 'attachment',
        ...(attachment.cid ? { id: attachment.cid } : {}),
      };
    });
    if (attachments.length) emailParams.setAttachments(attachments);

    const res = await this.mailersend.send(emailParams);
    if (!res.ok) {
      throw new Error(
        `MailerSend rejected the email (${res.status}): ${await errorMessage(
          res,
        )}`,
      );
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

// Workflow emails pass comma-separated address lists; the API wants one Recipient each.
function toRecipients(addresses: string): Recipient[] {
  return String(addresses)
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
    .map((address) => new Recipient(address));
}

async function errorMessage(res: {
  json: () => Promise<any>;
  statusText: string;
}): Promise<string> {
  try {
    const body = await res.json();
    return body?.message || res.statusText;
  } catch {
    return res.statusText;
  }
}
