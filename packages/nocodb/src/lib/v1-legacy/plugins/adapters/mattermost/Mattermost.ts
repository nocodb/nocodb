import axios from 'axios';

export default class Mattermost {
  public static async sendMessage(
    text: string,
    webhooks: Array<{
      webhook_url: string;
    }>
  ): Promise<any> {
    for (const { webhook_url } of webhooks) {
      try {
        await axios.post(webhook_url, {
          text,
        });
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  }
}
