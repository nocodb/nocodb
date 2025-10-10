import {
  objRemoveEmptyStringProps,
  WebhookActions,
  WebhookEvents,
} from 'nocodb-sdk';
import {
  ViewWebhookManagerBuilder as ViewWebhookManagerBuilderCE,
  ViewWebhookManager as ViewWebhookManagerCE,
} from 'src/utils/view-webhook-manager';
import { NcError } from '~/helpers/ncError';
import Noco from '~/Noco';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';

export class ViewWebhookManagerBuilder extends ViewWebhookManagerBuilderCE {
  override forCreate() {
    if (!this.modelId) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forCreate'`,
      );
    }
    return new ViewWebhookManager(
      this.context,
      {
        action: WebhookActions.INSERT,
        modelId: this.modelId!,
        modelWebhookManager: this.modelWebhookManager,
      },
      this.ncMeta,
    );
  }

  override forUpdate() {
    if (!this.modelId) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forUpdate'`,
      );
    }
    if (!this.oldView) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withView' before running 'forUpdate'`,
      );
    }
    return new ViewWebhookManager(
      this.context,
      {
        action: WebhookActions.UPDATE,
        modelId: this.modelId!,
        oldView: this.oldView,
        modelWebhookManager: this.modelWebhookManager,
      },
      this.ncMeta,
    );
  }

  override forDelete() {
    if (!this.modelId) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forDelete'`,
      );
    }
    if (!this.oldView) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withView' before running 'forDelete'`,
      );
    }
    return new ViewWebhookManager(
      this.context,
      {
        action: WebhookActions.DELETE,
        modelId: this.modelId!,
        oldView: this.oldView,
        modelWebhookManager: this.modelWebhookManager,
      },
      this.ncMeta,
    );
  }
}

export class ViewWebhookManager extends ViewWebhookManagerCE {
  isOldAndNewEqual(oldView, newView) {
    const compareOld = {
      ...oldView,
      created_at: null,
      updated_at: null,
    };
    const compareNew = {
      ...newView,
      created_at: null,
      updated_at: null,
    };
    return (
      JSON.stringify(objRemoveEmptyStringProps(compareOld)) ===
      JSON.stringify(objRemoveEmptyStringProps(compareNew))
    );
  }

  override emit() {
    // if modelWebhookManager exists, we do not emit
    if (!this.emitted && !this.params.modelWebhookManager) {
      // if no changes on the view, do not emit
      if (
        this.params.action === WebhookActions.UPDATE &&
        this.isOldAndNewEqual(this.params.oldView, this.params.newView)
      ) {
        return;
      }
      Noco.eventEmitter.emit(HANDLE_WEBHOOK, {
        context: this.context,
        hookName: `${WebhookEvents.VIEW}.${this.params.action}`,
        prevData: this.params.oldView,
        newData: this.params.newView,
        user: this.context.user,
        modelId: this.params.modelId,
      });
      this.emitted = true;
    }
  }
}
