import fs from 'fs';
import { promisify } from 'util';

import jsonfile from 'jsonfile';

export default class FileCollection {
  public args;
  public path;
  constructor(args) {
    this.args = args;
    this.path = args.path;
  }

  async init() {
    /**
     *  if args.path doesn't exists
     *    create an empty json file with an array
     */
    const exists = await promisify(fs.exists)(this.args.path);

    if (!exists) {
      await promisify(jsonfile.writeFile)(this.args.path, [], {
        spaces: 2
      });
    }
  }

  async read() {
    return await promisify(jsonfile.readFile)(this.args.path);
  }

  async write(args) {
    await promisify(jsonfile.writeFile)(this.args.path, args.data, {
      spaces: 2
    });
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
