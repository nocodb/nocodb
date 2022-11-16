import inquirer from 'inquirer';
import path from 'path';

class ComponentMgr {
  public static async add(_args) {
    const components = require(path.join(
      process.cwd(),
      './server/app.components.js'
    ));

    const answer = await inquirer.prompt([
      {
        choices: components.components.map(component => component.title),
        message:
          'Choose after which component should we insert the new component?',
        name: 'compoonent',
        type: 'list'
      }
    ]);

    return answer.compoonent;
  }

  // tslint:disable-next-line:no-empty
  public static async rename(_args) {}

  // tslint:disable-next-line:no-empty
  public static async delete(_args) {}
}

export default ComponentMgr;
