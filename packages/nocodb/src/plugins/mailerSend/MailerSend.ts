import { IEmailAdapter } from 'nc-plugin';
import MailerSend, { EmailParams, Recipient } from 'mailersend';

import { XcEmail } from '../../interface/IEmailAdapter';

export default class Mailer implements IEmailAdapter {
  private mailersend: MailerSend;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init(): Promise<any> {
    this.mailersend = new MailerSend({
      api_key: this.input?.api_key
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
        html: 'Test email'
      } as any);
      return true;
    } catch (e) {
      throw e;
    }
  }
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
