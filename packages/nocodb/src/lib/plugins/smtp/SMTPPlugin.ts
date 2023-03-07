import type { IEmailAdapter } from 'nc-plugin';
import { XcEmailPlugin } from 'nc-plugin';

import SMTP from './SMTP';

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
