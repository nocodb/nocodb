import axios from 'axios';
import { OperationSource } from 'nocodb-sdk';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';
import { getFilteredAgents } from '~/utils/ssrf';

export default class Teams implements IWebhookNotificationAdapter {
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(Text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels || []) {
      try {
        return await axios.post(
          webhook_url,
          { Text },
          getFilteredAgents({
            url: webhook_url,
            source: OperationSource.PLUGINS,
          }),
        );
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  }
}
