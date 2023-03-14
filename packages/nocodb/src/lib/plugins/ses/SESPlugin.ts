import { XcEmailPlugin } from 'nc-plugin';
import SES from './SES';
import type { IEmailAdapter } from 'nc-plugin';

class SESPlugin extends XcEmailPlugin {
  private static storageAdapter: SES;

  public getAdapter(): IEmailAdapter {
    return SESPlugin.storageAdapter;
  }

  public async init(config: any): Promise<any> {
    SESPlugin.storageAdapter = new SES(config);
    await SESPlugin.storageAdapter.init();
  }
}

export default SESPlugin;
