import { WebhookActions } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { IColumnsV3Service } from 'src/services/v3/columns-v3.types';
import type { MetaService } from '~/meta/meta.service';
import type { Model } from '~/models';
import type { ModelWebhookManager } from '~/utils/model-webhook-manager';
import Noco from '~/Noco';

export class ColumnWebhookManagerBuilder {
  constructor(
    protected readonly context: NcContext,
    protected readonly ncMeta?: MetaService,
  ) {}
  modelWebhookManager?: ModelWebhookManager;
  modelId?: string;
  oldColumns: any[] = [];

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
  addColumn(column: any) {
    if (this.oldColumns.find((col) => col.id === column.id)) {
      return this;
    }
    if (column.system) {
      return this;
    }
    this.oldColumns.push(column);
    return this;
  }
  async addColumnById(columnId: string) {
    if (this.oldColumns.find((col) => col.id === columnId)) {
      return this;
    }
    // needed to prevent circular dependencies
    const columnsV3Service: IColumnsV3Service =
      Noco.nestApp.get('IColumnsV3Service');
    const column = await columnsV3Service.columnGet(
      this.context,
      { columnId },
      this.ncMeta,
    );
    if (column.system) {
      return this;
    }
    this.oldColumns.push(column);
    return this;
  }

  forCreate() {
    return new ColumnWebhookManager(this.context, {
      action: WebhookActions.INSERT,
      modelId: this.modelId!,
      modelWebhookManager: this.modelWebhookManager,
      oldColumns: this.oldColumns,
    });
  }

  forUpdate() {
    return new ColumnWebhookManager(this.context, {
      action: WebhookActions.UPDATE,
      modelId: this.modelId!,
      oldColumns: this.oldColumns,
      modelWebhookManager: this.modelWebhookManager,
    });
  }

  forDelete() {
    return new ColumnWebhookManager(
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

export class ColumnWebhookManager {
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

  protected emitted = false;

  async populateNewColumns() {
    return this;
  }
  async addOldColumnById(_param: {
    columnId: string;
    action?: WebhookActions;
    context?: {
      workspace_id: string;
      base_id: string;
    };
  }) {
    return this;
  }
  async addOldColumn(_param: {
    column: any;
    action?: WebhookActions;
    context?: {
      workspace_id: string;
      base_id: string;
    };
  }) {
    return this;
  }
  async addNewColumnById(_param: {
    columnId: string;
    action?: WebhookActions;
    context?: {
      workspace_id: string;
      base_id: string;
    };
  }) {
    return this;
  }
  async addNewColumn(_param: {
    column: any;
    action?: WebhookActions;
    context?: {
      workspace_id: string;
      base_id: string;
    };
  }) {
    return this;
  }

  emit() {}
}
