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
