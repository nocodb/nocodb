/**
 * Heirarchical conversation example
 */

'use strict';
import inquirer from 'inquirer';

class RunOrDownload {
  public static async prepareCmd(ipc, args) {
    args._[0] = '';

    const answers = await inquirer.prompt([
      {
        choices: ['gen', 'add', 'show', 'run'],
        message: 'What do you want to do?',
        name: 'action',
        type: 'rawlist'
      }
    ]);

    args._[0] = answers.action;

    switch (answers.action) {
      case 'gen':
        await this.handleGen(ipc, args);
        break;

      case 'add':
        break;

      case 'show':
        break;

      case 'run':
        break;
    }
  }

  public static async handleGen(_ipc, args) {
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
          'apis'
        ],
        message: 'What do you want to generate ?',
        name: 'action',
        pageSize: 9,
        type: 'rawlist'
      }
    ]);

    args._[0] += `:${a1.action}`;

    switch (a1.action) {
      case 'apis':
        const a2 = await inquirer.prompt([
          {
            choices: ['rest', 'graphql'],
            message: 'Which apis you want to use?',
            name: 'action',
            type: 'rawlist'
          }
        ]);

        args._[0] += `:${a2.action}`;

        break;
    }
  }

  // tslint:disable-next-line:no-empty
  public static async handleAdd() {}

  // tslint:disable-next-line:no-empty
  public static async handleShow() {}

  // tslint:disable-next-line:no-empty
  public static async handleRun() {}
}

export default RunOrDownload;
