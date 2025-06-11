import { NcApiVersion, type NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';
import Noco from '~/Noco';

export type WebhookContext = {
  context: NcContext;
  user: any;
  baseModel: IBaseModelSqlV2;
  isSingleUpdate?: boolean;
  ignoreWebhook?: boolean;
};

export class UpdateWebhookHandler {
  private constructor(
    private webhookContext: WebhookContext,
    private rowId: any,
  ) {
    this.webhookContext = webhookContext;
    this.rowId = rowId;
  }
  protected prevData: any;
  protected nextData: any;

  public static async beginUpdate(payload: WebhookContext, rowId: any) {
    const webhookHandler = new UpdateWebhookHandler(payload, rowId);
    await webhookHandler.sendBeforeUpdateWebhook();
    return webhookHandler;
  }

  getData() {
    return {
      prevData: this.prevData,
      nextData: this.nextData,
    };
  }

  // // experimental, will be useful after refactoring

  // public static async manageWebhook(
  //   payload: WebhookContext,
  //   prevData: any,
  //   handler: () => Promise<void> | Promise<any>,
  // ) {
  //   const webhookHandler = await this.beginUpdate(payload, prevData);
  //   const handlerResult = await handler();
  //   await webhookHandler.finishUpdate();
  //   return handlerResult;
  // }

  async sendBeforeUpdateWebhook() {
    const hookName = `before.${
      this.webhookContext.isSingleUpdate === false ? 'bulkUpdate' : 'update'
    }`;
    this.prevData = await this.webhookContext.baseModel.readByPk(
      this.rowId,
      false,
      {},
      { ignoreView: true, apiVersion: NcApiVersion.V3 },
    );
    if (this.webhookContext.ignoreWebhook !== false) {
      this.sendWebhook(hookName, this.prevData);
    }
  }
  async finishUpdate() {
    const hookName = `after.${
      this.webhookContext.isSingleUpdate === false ? 'bulkUpdate' : 'update'
    }`;
    this.nextData = await this.webhookContext.baseModel.readByPk(
      this.rowId,
      false,
      {},
      { ignoreView: true, apiVersion: NcApiVersion.V3 },
    );
    if (this.webhookContext.ignoreWebhook !== false) {
      this.sendWebhook(hookName, this.prevData, this.nextData);
    }
  }
  sendWebhook(hookName: string, prevData: any, nextData?: any) {
    Noco.eventEmitter.emit(HANDLE_WEBHOOK, {
      context: this.webhookContext.context,
      hookName,
      prevData,
      newData: nextData,
      user: this.webhookContext.user,
      viewId: this.webhookContext.baseModel.getViewId(),
      modelId: this.webhookContext.baseModel.model.id,
      tnPath: this.webhookContext.baseModel.tnPath,
    });
  }
}
