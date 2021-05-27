/**
 * Heirarchical conversation example
 */

'use strict';
import inquirer from "inquirer";

class RunOrDownload {

  public static async handle(_args) {

    const answers = await inquirer.prompt([
        {
          choices: [
            'Open the app!',
            'Download it for FREE'
          ],
          message: 'Your XGENE desktop app is not open - do you want to ?',
          name: 'action',
          type: 'rawlist'
        }
      ]);

    switch (answers.action) {

      case 'Open app!':
        break;

      case 'Download it for FREE':
        console.log('wget(https://xgene.cloud/download?latest=true) to Downloads');
        break;

    }
  }


}


export default RunOrDownload;

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
