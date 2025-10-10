import { WebhookActions } from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { Model } from '~/models';
import type { IViewsV3Service } from '~/services/v3/views-v3.types';
import type { ModelWebhookManager } from '~/utils/model-webhook-manager';
import { NcError } from '~/helpers/ncError';
import Noco from '~/Noco';

export class ViewWebhookManagerBuilder {
  constructor(
    protected readonly context: NcContext,
    protected readonly ncMeta?: MetaService,
  ) {}
  modelWebhookManager?: ModelWebhookManager;
  modelId?: string;
  oldView?: any;
  withModelManager(modelWebhookManager: ModelWebhookManager) {
    this.modelWebhookManager = modelWebhookManager;
    return this;
  }
  withModel(model: Model) {
    this.modelId = model.id;
    return this;
  }
  async withModelId(modelId: string) {
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

  forUpdate() {
    if (!this.modelId) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forUpdate'`,
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

  forDelete() {
    if (!this.modelId) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forDelete'`,
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

export class ViewWebhookManager {
  constructor(
    protected readonly context: NcContext,
    protected readonly params: {
      action: WebhookActions;
      modelId: string;
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
  emit() {}
}
