import { Injectable } from '@nestjs/common';
import type { MailParams } from 'src/interface/Mail';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';

@Injectable()
export class MailService {
  async getAdapter() {
    try {
      return await NcPluginMgrv2.emailAdapter();
    } catch (e) {
      console.error('Plugin not configured / active');
      return null;
    }
  }

  async sendMail(params: MailParams) {
    const mailerAdapter = await this.getAdapter();
    if (!mailerAdapter) {
      console.error('Plugin not configured / active');
      return;
    }
  }
}
