export default interface IWebhookNotificationAdapter {
  init(): Promise<any>;

  sendMessage(
    content: string,
    webhooks: Array<{
      webhook_url: string;
    }>,
  ): Promise<any>;
}
