import {
  objRemoveEmptyStringProps,
  WebhookActions,
  WebhookEvents,
} from 'nocodb-sdk';
import type { IColumnsV3Service } from 'src/services/v3/columns-v3.types';
import type { ModelWebhookManager } from '~/utils/model-webhook-manager';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { IViewsV3Service } from '~/services/v3/views-v3.types';
import type { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';
import { Column, Model } from '~/models';
import { NcError } from '~/helpers/ncError';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';

export class FieldWebhookManagerBuilder {
  constructor(
    protected readonly context: NcContext,
    protected readonly ncMeta?: MetaService,
  ) {}
  modelWebhookManager?: ModelWebhookManager;
  model?: Model;
  modelId?: string;
  oldColumns: any[] = [];

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
  async addColumnById(columnId: string) {
    // needed to prevent circular dependencies
    const columnsV3Service: IColumnsV3Service =
      Noco.nestApp.get('IColumnsV3Service');
    this.oldColumns.push(
      await columnsV3Service.columnGet(this.context, { columnId }, this.ncMeta),
    );
    return this;
  }

  forCreate() {
    if (!this.model) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forCreate'`,
      );
    }
    return new FieldWebhookManager(this.context, {
      action: WebhookActions.INSERT,
      model: this.model!,
      modelId: this.modelId!,
      modelWebhookManager: this.modelWebhookManager,
      oldColumns: this.oldColumns,
    });
  }

  forUpdate() {
    if (!this.model) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forUpdate'`,
      );
    }
    if (!this.oldColumns.length) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withView' before running 'forUpdate'`,
      );
    }
    return new FieldWebhookManager(this.context, {
      action: WebhookActions.UPDATE,
      modelId: this.modelId!,
      oldColumns: this.oldColumns,
      modelWebhookManager: this.modelWebhookManager,
    });
  }

  forDelete() {
    if (!this.model) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forDelete'`,
      );
    }
    if (!this.oldColumns.length) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withView' before running 'forDelete'`,
      );
    }
    return new FieldWebhookManager(
      this.context,
      {
        action: WebhookActions.DELETE,
        modelId: this.modelId!,
        oldColumns: this.oldColumns,
        modelWebhookManager: this.modelWebhookManager,
      },
      this.ncMeta,
    );
  }
}

export class FieldWebhookManager {
  constructor(
    protected readonly context: NcContext,
    protected readonly params: {
      action: WebhookActions;
      modelId: string;
      oldColumns: any[];
      newColumns?: any[];
      modelWebhookManager?: ModelWebhookManager;
    },
    protected readonly ncMeta?: MetaService,
  ) {
    this.params.newColumns = this.params.newColumns ?? [];
  }

  relatedFieldWebhookManager: Map<string, FieldWebhookManager> = new Map();

  protected emitted = false;

  async populateNewColumns() {
    if (
      this.params.action !== WebhookActions.UPDATE ||
      !this.params.oldColumns.length
    ) {
      return;
    }
    // needed to prevent circular dependencies
    const columnsV3Service: IColumnsV3Service =
      Noco.nestApp.get('IColumnsV3Service');
    const result = [];
    for (const column of this.params.oldColumns) {
      result.push(
        await columnsV3Service.columnGet(
          this.context,
          { columnId: column.id },
          this.ncMeta,
        ),
      );
    }
    this.params.newColumns = result;
    return this;
  }
  async addNewColumnById(columnId: string) {
    // needed to prevent circular dependencies
    const columnsV3Service: IColumnsV3Service =
      Noco.nestApp.get('IColumnsV3Service');
    const newColumn = await columnsV3Service.columnGet(
      this.context,
      { columnId },
      this.ncMeta,
    );
    this.params.newColumns.push(newColumn);
    return this;
  }

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
        hookName: `${WebhookEvents.FIELD}.${this.params.action}`,
        prevData: this.params.oldView,
        newData: this.params.newView,
        user: this.context.user,
        modelId: this.params.modelId,
      });
      this.emitted = true;
    }
  }
}
