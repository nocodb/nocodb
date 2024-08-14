import SMTP from './SMTP';
import type { IEmailAdapter } from '~/types/nc-plugin';
import { XcEmailPlugin } from '~/types/nc-plugin';

class SMTPPlugin extends XcEmailPlugin {
  private static storageAdapter: SMTP;

  public getAdapter(): IEmailAdapter {
    return SMTPPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    SMTPPlugin.storageAdapter = new SMTP(config);
    await SMTPPlugin.storageAdapter.init();
  }
}

export default SMTPPlugin;
