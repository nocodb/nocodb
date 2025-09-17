import {
  objRemoveEmptyStringProps,
  WebhookActions,
  WebhookEvents,
} from 'nocodb-sdk';
import type { ModelWebhookManager } from '~/utils/model-webhook-manager';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { IViewsV3Service } from '~/services/v3/views-v3.types';
import type { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';
import { Model } from '~/models';
import { NcError } from '~/helpers/ncError';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';

export class ViewWebhookManagerBuilder {
  constructor(
    protected readonly context: NcContext,
    protected readonly ncMeta?: MetaService,
  ) {}
  modelWebhookManager?: ModelWebhookManager;
  model?: Model;
  modelId?: string;
  oldView?: any;
  withModelManager(modelWebhookManager: ModelWebhookManager) {
    this.modelWebhookManager = modelWebhookManager;
    return this;
  }
  withModel(model: Model) {
    this.model = model;
    this.modelId = model.id;
    return this;
  }
  async withModelId(modelId: string) {
    this.model = await Model.getByIdOrName(
      this.context,
      {
        id: modelId,
      },
      this.ncMeta,
    );
    this.modelId = modelId;
    return this;
  }
  async withView(view: any) {
    this.oldView = view;
    return this;
  }
  async withViewId(viewId: string, req?: NcRequest) {
    // needed to prevent circular dependencies
    const viewsV3Service: IViewsV3Service = Noco.nestApp.get('IViewsV3Service');
    this.oldView = await viewsV3Service.getView(
      this.context,
      {
        viewId,
        req,
      },
      this.ncMeta,
    );
    return this;
  }

  forCreate() {
    if (!this.model) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forCreate'`,
      );
    }
    return new ViewWebhookManager(this.context, {
      action: WebhookActions.INSERT,
      model: this.model!,
      modelId: this.modelId!,
      modelWebhookManager: this.modelWebhookManager,
    });
  }

  forUpdate() {
    if (!this.model) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forUpdate'`,
      );
    }
    if (!this.oldView) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withView' before running 'forUpdate'`,
      );
    }
    return new ViewWebhookManager(this.context, {
      action: WebhookActions.UPDATE,
      model: this.model!,
      modelId: this.modelId!,
      oldView: this.oldView,
      modelWebhookManager: this.modelWebhookManager,
    });
  }

  forDelete() {
    if (!this.model) {
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
        model: this.model!,
        modelId: this.modelId!,
        oldView: this.oldView,
        modelWebhookManager: this.modelWebhookManager,
      },
      this.ncMeta,
    );
  }
}

export class ViewWebhookManager {
  constructor(
    protected readonly context: NcContext,
    protected readonly params: {
      action: WebhookActions;
      modelId: string;
      model: Model;
      oldView?: any;
      newView?: any;
      modelWebhookManager?: ModelWebhookManager;
    },
    protected readonly ncMeta?: MetaService,
  ) {}

  protected emitted = false;

  withNewView(view: any) {
    this.params.newView = view;
    return this;
  }
  async withNewViewId(viewId: string, req?: NcRequest) {
    // needed to prevent circular dependencies
    const viewsV3Service: IViewsV3Service = Noco.nestApp.get('IViewsV3Service');
    this.params.newView = await viewsV3Service.getView(
      this.context,
      {
        viewId,
        req,
      },
      this.ncMeta,
    );
    return this;
  }

  getViewId() {
    return (this.params.oldView?.id ?? this.params.newView?.id) as string;
  }

  isOldAndNewEqual(oldView, newView) {
    return (
      JSON.stringify(objRemoveEmptyStringProps(oldView)) ===
      JSON.stringify(objRemoveEmptyStringProps(newView))
    );
  }

  emit() {
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
