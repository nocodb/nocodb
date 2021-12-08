import IEmailAdapter from '../../../../../interface/IEmailAdapter';

import SES from './SES';
import SMTP from './SMTP';

export default class EmailFactory {
  private static instance: IEmailAdapter;

  // tslint:disable-next-line:typedef
  public static create(config: any, overwrite = false): IEmailAdapter {
    if (this.instance && !overwrite) {
      return this.instance;
    }

    if (config) {
      const input = JSON.parse(config.input);
      this.instance = this.createNewInstance(config, input);
    }

    return this.instance;
  }

  public static createNewInstance(config: any, input: any): IEmailAdapter {
    switch (config.title) {
      case 'SMTP':
        return new SMTP(input);
        break;
      case 'SES':
        return new SES(input);
      default:
        throw new Error('Test not implemented');
        break;
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
