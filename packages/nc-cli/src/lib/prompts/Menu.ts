/**
 * Heirarchical conversation example
 */

'use strict';
import  inquirer from 'inquirer';

class RunOrDownload {

  public static async prepareCmd(ipc, args) {

    args._[0] = '';

    const answers = await inquirer.prompt([
      {
        choices: [
          'gen',
          'add',
          'show',
          'run',
        ],
        message: 'What do you want to do?',
        name: 'action',
        type: 'rawlist'
      }]);

    args._[0] = answers.action;

    switch (answers.action) {

      case 'gen':
        await this.handleGen(ipc,args)
        break;

      case 'add':
        break;

      case 'show':
        break;

      case 'run':
        break;


    }
  }

  public static async handleGen(_ipc,args) {

    const a1 = await inquirer.prompt([
      {
        choices: [
          'apis',
          'backend',
          'block',
          'controller',
          'middleware',
          'service',
          'resolver',
          'type',
          'schema',
          'apis',
        ],
        message: 'What do you want to generate ?',
        name: 'action',
        pageSize: 9,
        type: 'rawlist'
      }]);

    args._[0] += `:${a1.action}`;

    switch (a1.action) {

      case 'apis':

        const a2 = await inquirer.prompt([
          {
            choices: [
              'rest',
              'graphql'
            ],
            message: 'Which apis you want to use?',
            name: 'action',
            type: 'rawlist'
          }]);

        args._[0] += `:${a2.action}`;

        break;

    }
  }

  // tslint:disable-next-line:no-empty
  public static async handleAdd() {

  }

  // tslint:disable-next-line:no-empty
  public static async handleShow() {

  }

  // tslint:disable-next-line:no-empty
  public static async handleRun() {

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
