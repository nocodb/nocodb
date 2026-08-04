import axios from 'axios';
import { OperationSource } from 'nocodb-sdk';
import type { IWebhookNotificationAdapter } from '~/types/nc-plugin';
import { getFilteredAgents } from '~/utils/ssrf';

export default class Mattermost implements IWebhookNotificationAdapter {
  public init(): Promise<any> {
    return Promise.resolve(undefined);
  }

  public async sendMessage(text: string, payload: any): Promise<any> {
    for (const { webhook_url } of payload?.channels || []) {
      try {
        return await axios.post(
          webhook_url,
          { text },
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
