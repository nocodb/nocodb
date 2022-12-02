/**
 * Heirarchical conversation example
 */

'use strict';
import inquirer from 'inquirer';

class RunOrDownload {
  public static async handle(_args) {
    const answers = await inquirer.prompt([
      {
        choices: ['Open the app!', 'Download it for FREE'],
        message: 'Your XGENE desktop app is not open - do you want to ?',
        name: 'action',
        type: 'rawlist'
      }
    ]);

    switch (answers.action) {
      case 'Open app!':
        break;

      case 'Download it for FREE':
        console.log(
          'wget(https://xgene.cloud/download?latest=true) to Downloads'
        );
        break;
    }
  }
}

export default RunOrDownload;
