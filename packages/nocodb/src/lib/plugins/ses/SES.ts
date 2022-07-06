import { IEmailAdapter } from 'nc-plugin';
import nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import AWS from 'aws-sdk';
import { XcEmail } from '../../../interface/IEmailAdapter';

export default class SES implements IEmailAdapter {
  private transporter: Mail;
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init(): Promise<any> {
    const sesOptions: any = {
      accessKeyId: this.input.access_key,
      secretAccessKey: this.input.access_secret,
      region: this.input.region,
    };

    this.transporter = nodemailer.createTransport({
      SES: new AWS.SES(sesOptions),
    });
  }

  public async mailSend(mail: XcEmail): Promise<any> {
    if (this.transporter) {
      this.transporter.sendMail(
        { ...mail, from: this.input.from },
        (err, info) => {
          if (err) {
            console.log(err);
          } else {
            console.log('Message sent: ' + info.response);
          }
        }
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
      throw e;
    }
  }
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
