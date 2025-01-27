import { UpdateWebhookHandler } from './update-webhook-handler';
import type { NcContext } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from './BaseModelSqlv2';

export type RelationUpdateWebhookContext = {
  context: NcContext;
  user: any;
  parentBaseModel: BaseModelSqlv2;
  childBaseModel: BaseModelSqlv2;
  ignoreWebhook?: boolean;
};
export class RelationUpdateWebhookHandler {
  private constructor(
    private relationWebhookContext: RelationUpdateWebhookContext,
    private parentRowId: any,
    private childRowId: any,
  ) {}

  parentUpdateWebhookHandler: UpdateWebhookHandler;
  childUpdateWebhookHandler: UpdateWebhookHandler;

  public static async beginUpdate(
    payload: RelationUpdateWebhookContext,
    rowId: {
      parent: any;
      child: any;
    },
  ) {
    const relationUpdateWebhookHandler = new RelationUpdateWebhookHandler(
      payload,
      rowId.parent,
      rowId.child,
    );
    await relationUpdateWebhookHandler.sendBeforeUpdateWebhook();
    return relationUpdateWebhookHandler;
  }

  // // experimental, will be useful after refactoring

  // public static async manageWebhook(
  //   payload: RelationUpdateWebhookContext,
  //   rowId: {
  //     parent: any;
  //     child: any;
  //   },
  //   handler: () => Promise<void> | Promise<any>,
  // ) {
  //   const relationUpdateWebhookHandler = await this.beginUpdate(payload, rowId);
  //   const handlerResult = await handler();
  //   await relationUpdateWebhookHandler.finishUpdate();
  //   return handlerResult;
  // }

  async sendBeforeUpdateWebhook() {
    this.parentUpdateWebhookHandler = await UpdateWebhookHandler.beginUpdate(
      {
        context: this.relationWebhookContext.context,
        user: this.relationWebhookContext.user,
        baseModel: this.relationWebhookContext.parentBaseModel,
        isSingleUpdate: true,
        ignoreWebhook: this.relationWebhookContext.ignoreWebhook,
      },
      this.parentRowId,
    );
    if (this.parentRowId != this.childRowId) {
      this.childUpdateWebhookHandler = await UpdateWebhookHandler.beginUpdate(
        {
          context: this.relationWebhookContext.context,
          user: this.relationWebhookContext.user,
          baseModel: this.relationWebhookContext.childBaseModel,
          isSingleUpdate: true,
          ignoreWebhook: this.relationWebhookContext.ignoreWebhook,
        },
        this.childRowId,
      );
    }
  }
  async finishUpdate() {
    await this.parentUpdateWebhookHandler.finishUpdate();
    if (this.parentRowId != this.childRowId) {
      await this.childUpdateWebhookHandler.finishUpdate();
    }
  }
}
