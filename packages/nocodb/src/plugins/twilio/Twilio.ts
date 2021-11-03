import { IWebhookNotificationAdapter } from 'nc-plugin';
import twilio from 'twilio';

export default class Twilio implements IWebhookNotificationAdapter {
  private input: any;
  private client: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init() {
    this.client = twilio(this.input.sid, this.input.token);
  }

  public async sendMessage(content: string, payload: any): Promise<any> {
    for (const num of payload?.to?.split(/\s*?,\s*?/)) {
      try {
        await this.client.messages.create({
          body: content,
          from: this.input.from,
          to: num
        });
      } catch (e) {
        console.log(e);
      }
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
