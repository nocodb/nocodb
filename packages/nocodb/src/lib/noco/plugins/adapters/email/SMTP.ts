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
      // from: this.input.from,
      // options: {
      host: this.input?.host,
      port: parseInt(this.input?.port, 10),
      secure: this.input?.secure === 'true',
      ignoreTLS: this.input?.ignoreTLS === 'true',
      auth: {
        user: this.input?.username,
        pass: this.input?.password
      }
      // }
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
