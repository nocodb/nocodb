import Noco from 'src/Noco';
import { HANDLE_WEBHOOK } from 'src/services/hook-handler.service';
import type { NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';

export class UpdateWebhookHandler {
  private constructor(
    webhookContext: {
      context: NcContext;
      user: any;
      viewId: string;
      modelId: string;
      tnPath: string | Knex.Raw<any>;
      isSingleUpdate?: boolean;
      ignoreWebhook?: boolean;
    },
    prevData: any,
  ) {
    this.webhookContext = webhookContext;
    this.prevData = prevData;
  }
  webhookContext: {
    context: NcContext;
    user: any;
    viewId: string;
    modelId: string;
    tnPath: string | Knex.Raw<any>;
    isSingleUpdate?: boolean;
    ignoreWebhook?: boolean;
  };
  prevData: any;

  public static beginUpdate(
    payload: {
      context: NcContext;
      user: any;
      viewId: string;
      modelId: string;
      tnPath: string | Knex.Raw<any>;
      isSingleUpdate?: boolean;
      ignoreWebhook?: boolean;
    },
    prevData: any,
  ) {
    const webhookHandler = new UpdateWebhookHandler(payload, prevData);
    webhookHandler.sendBeforeUpdateWebhook();
    return webhookHandler;
  }

  // experimental, will be useful when refactoring

  // public static async manageWebhook(
  //   payload: {
  //     context: NcContext;
  //     user: any;
  //     viewId: string;
  //     modelId: string;
  //     tnPath: string | any; // should be Knex.Raw<any>
  //     isSingleUpdate?: boolean;
  //     ignoreWebhook?: boolean;
  //   },
  //   prevData: any,
  //   handler: (setNextData: (nextData) => void) => Promise<void> | Promise<any>,
  // ) {
  //   const webhookHandler = this.beginUpdate(payload, prevData);
  //   let nextData;
  //   const handlerResult = await handler((updateNextData) => {
  //     nextData = updateNextData;
  //   });
  //   webhookHandler.finishUpdate(nextData);
  //   return handlerResult;
  // }

  sendBeforeUpdateWebhook() {
    const hookName = `before.${
      this.webhookContext.isSingleUpdate === false ? 'bulkUpdate' : 'update'
    }`;
    if (this.webhookContext.ignoreWebhook !== false) {
      this.sendWebhook(hookName, this.prevData);
    }
  }
  finishUpdate(nextData: any) {
    const hookName = `after.${
      this.webhookContext.isSingleUpdate === false ? 'bulkUpdate' : 'update'
    }`;
    if (this.webhookContext.ignoreWebhook !== false) {
      this.sendWebhook(hookName, this.prevData, nextData);
    }
  }
  sendWebhook(hookName: string, prevData: any, nextData?: any) {
    Noco.eventEmitter.emit(HANDLE_WEBHOOK, {
      context: this.webhookContext.context,
      hookName,
      prevData,
      newData: nextData,
      user: this.webhookContext.user,
      viewId: this.webhookContext.viewId,
      modelId: this.webhookContext.modelId,
      tnPath: this.webhookContext.tnPath,
    });
  }
}
