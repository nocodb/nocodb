import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { NcContext } from 'nocodb-sdk';
import { UpdateWebhookHandler } from '~/db/update-webhook-handler';

export type RelationUpdateWebhookContext = {
  context: NcContext;
  user: any;
  parentBaseModel: IBaseModelSqlV2;
  childBaseModel: IBaseModelSqlV2;
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
  affectedChildUpdateWebhookHandler: UpdateWebhookHandler;
  affectedParentUpdateWebhookHandler: UpdateWebhookHandler;

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

    if (
      this.relationWebhookContext.parentBaseModel.model.id !==
        this.relationWebhookContext.childBaseModel.model.id ||
      this.parentRowId !== this.childRowId
    ) {
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

  async addAffectedParentId(parentRowId: any) {
    this.affectedParentUpdateWebhookHandler =
      await UpdateWebhookHandler.beginUpdate(
        {
          context: this.relationWebhookContext.context,
          user: this.relationWebhookContext.user,
          baseModel: this.relationWebhookContext.parentBaseModel,
          isSingleUpdate: true,
          ignoreWebhook: this.relationWebhookContext.ignoreWebhook,
        },
        parentRowId,
      );
  }

  async addAffectedChildId(childRowId: any) {
    this.affectedChildUpdateWebhookHandler =
      await UpdateWebhookHandler.beginUpdate(
        {
          context: this.relationWebhookContext.context,
          user: this.relationWebhookContext.user,
          baseModel: this.relationWebhookContext.childBaseModel,
          isSingleUpdate: true,
          ignoreWebhook: this.relationWebhookContext.ignoreWebhook,
        },
        childRowId,
      );
  }

  async finishUpdate() {
    await this.parentUpdateWebhookHandler.finishUpdate();
    if (this.childUpdateWebhookHandler) {
      await this.childUpdateWebhookHandler.finishUpdate();
      if (this.affectedChildUpdateWebhookHandler) {
        await this.affectedChildUpdateWebhookHandler.finishUpdate();
      }
      if (this.affectedParentUpdateWebhookHandler) {
        await this.affectedParentUpdateWebhookHandler.finishUpdate();
      }
    }
  }
}
