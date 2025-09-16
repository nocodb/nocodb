import {
  objRemoveEmptyStringProps,
  RelationTypes,
  UITypes,
  WebhookActions,
  WebhookEvents,
} from 'nocodb-sdk';
import {
  ColumnWebhookManagerBuilder as ColumnWebhookManagerBuilderCE,
  ColumnWebhookManager as ColumnWebhookManagerCE,
} from 'src/utils/column-webhook-manager';
import type { NcContext } from 'nocodb-sdk';
import type { IColumnsV3Service } from 'src/services/v3/columns-v3.types';
import type { ModelWebhookManager } from '~/utils/model-webhook-manager';
import type { LinkToAnotherRecordColumn } from '~/models';
import { Column, type Model } from '~/models';
import { NcError } from '~/helpers/ncError';
import Noco from '~/Noco';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';

const ignoreColumn = async (
  context: NcContext,
  { column }: { column: any },
  ncMeta = Noco.ncMeta,
) => {
  if (
    [UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.type) &&
    column.system
  ) {
    const colObj = await Column.get(context, { colId: column.id }, ncMeta);
    const colOptions = await colObj.getColOptions<LinkToAnotherRecordColumn>(
      context,
      ncMeta,
    );
    if (colOptions.type === RelationTypes.HAS_MANY) {
      return true;
    }
  } else if (column.type === UITypes.ForeignKey) {
    return true;
  } else if (column.system) {
    return true;
  }
  return false;
};

export class ColumnWebhookManagerBuilder extends ColumnWebhookManagerBuilderCE {
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
    if (!this.modelId) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forCreate'`,
      );
    }
    return new ColumnWebhookManager(this.context, {
      action: WebhookActions.INSERT,
      modelId: this.modelId!,
      modelWebhookManager: this.modelWebhookManager,
      oldColumns: this.oldColumns,
    });
  }

  forUpdate() {
    if (!this.modelId) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forUpdate'`,
      );
    }
    if (!this.oldColumns.length) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withView' before running 'forUpdate'`,
      );
    }
    return new ColumnWebhookManager(this.context, {
      action: WebhookActions.UPDATE,
      modelId: this.modelId!,
      oldColumns: this.oldColumns,
      modelWebhookManager: this.modelWebhookManager,
    });
  }

  forDelete() {
    if (!this.modelId) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withModel' before running 'forDelete'`,
      );
    }
    if (!this.oldColumns.length) {
      NcError.get(this.context).internalServerError(
        `Need to call 'withView' before running 'forDelete'`,
      );
    }
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

export class ColumnWebhookManager extends ColumnWebhookManagerCE {
  relatedColumnWebhookManager: Map<
    string,
    Map<WebhookActions, ColumnWebhookManager>
  > = new Map();

  protected emitted = false;

  getOrCreateRelatedColumnWebhookManager(
    tableId: string,
    action: WebhookActions,
  ) {
    if (!this.relatedColumnWebhookManager.has(tableId)) {
      this.relatedColumnWebhookManager.set(tableId, new Map());
    }
    const tableActions = this.relatedColumnWebhookManager.get(tableId);
    if (!tableActions.has(action)) {
      tableActions.set(
        action,
        new ColumnWebhookManager(this.context, {
          action: action,
          modelId: tableId,
          oldColumns: [],
        }),
      );
    }
    return tableActions.get(action);
  }

  async populateRelatedNewColumns() {
    const promises: Promise<any | void>[] = [];
    for (const [_action, actionMap] of this.relatedColumnWebhookManager) {
      for (const [_tableId, relatedManager] of actionMap) {
        promises.push(relatedManager.populateNewColumns());
      }
    }
    return await Promise.all(promises);
  }

  async populateNewColumns() {
    if (
      this.params.action !== WebhookActions.UPDATE ||
      !this.params.oldColumns.length
    ) {
      await this.populateRelatedNewColumns();
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
    await this.populateRelatedNewColumns();
    return this;
  }
  async addOldColumnById(columnId: string, action?: WebhookActions) {
    // if column id exists, ignore
    if (this.params.oldColumns.find((col) => col.id === columnId)) {
      return this;
    }

    // needed to prevent circular dependencies
    const columnsV3Service: IColumnsV3Service =
      Noco.nestApp.get('IColumnsV3Service');
    const newColumn = await columnsV3Service.columnGet(
      this.context,
      { columnId },
      this.ncMeta,
    );
    await this.addOldColumn(newColumn, action);
    return this;
  }
  async addOldColumn(column: any, action?: WebhookActions) {
    // if column id exists, ignore
    if (this.params.oldColumns.find((col) => col.id === column.id)) {
      return this;
    }
    if (await ignoreColumn(this.context, { column }, this.ncMeta)) {
      return this;
    }

    if (
      // if table id is different
      column.table_id !== this.params.modelId ||
      // or if the action is somehow different
      (action && action !== this.params.action)
    ) {
      const relatedColumnWebhookManager =
        this.getOrCreateRelatedColumnWebhookManager(column.table_id, action);
      await relatedColumnWebhookManager.addOldColumn(column, action);
    } else {
      this.params.oldColumns.push(column);
    }
    return this;
  }
  async addNewColumnById(columnId: string, action?: WebhookActions) {
    // only valid on create column event
    if ((action ?? this.params.action) !== WebhookActions.INSERT) {
      return;
    }

    // if column id exists, ignore
    if (this.params.newColumns.find((col) => col.id === columnId)) {
      return this;
    }

    // needed to prevent circular dependencies
    const columnsV3Service: IColumnsV3Service =
      Noco.nestApp.get('IColumnsV3Service');
    const newColumn = await columnsV3Service.columnGet(
      this.context,
      { columnId },
      this.ncMeta,
    );

    await this.addNewColumn(newColumn, action);
    return this;
  }
  async addNewColumn(column: any, action?: WebhookActions) {
    // only valid on create column event
    if ((action ?? this.params.action) !== WebhookActions.INSERT) {
      return;
    }

    console.log(
      column.table_id,
      this.params.modelId,
      await ignoreColumn(this.context, { column }, this.ncMeta),
    );
    if (await ignoreColumn(this.context, { column }, this.ncMeta)) {
      return this;
    }

    // if column id exists, ignore
    if (this.params.newColumns.find((col) => col.id === column.id)) {
      return this;
    }

    if (
      // if table id is different
      column.table_id !== this.params.modelId ||
      // or if the action is somehow different
      (action && action !== this.params.action)
    ) {
      const relatedColumnWebhookManager =
        this.getOrCreateRelatedColumnWebhookManager(column.table_id, action);
      await relatedColumnWebhookManager.addNewColumn(column, action);
    } else {
      this.params.newColumns.push(column);
    }
    return this;
  }

  isOldAndNewEqual(oldColumn, newColumn) {
    const compareOld = {
      ...oldColumn,
      created_at: null,
      updated_at: null,
    };
    const compareNew = {
      ...newColumn,
      created_at: null,
      updated_at: null,
    };
    return (
      JSON.stringify(objRemoveEmptyStringProps(compareOld)) ===
      JSON.stringify(objRemoveEmptyStringProps(compareNew))
    );
  }

  getDiffCols(oldColumns: any[], newColumns: any[]) {
    const resultOldColumns: any[] = [];
    const resultNewColumns: any[] = [];
    // designed for the old and new columns to have same index
    for (let i = 0; i < oldColumns.length; i++) {
      const oldColumn = oldColumns[i];
      const newColumn = newColumns[i];
      if (!this.isOldAndNewEqual(oldColumn, newColumn)) {
        resultOldColumns.push(oldColumn);
        resultNewColumns.push(newColumn);
      }
    }
    return {
      oldColumns: resultOldColumns,
      newColumns: resultNewColumns,
    };
  }

  emitRelated() {
    for (const [_action, actionMap] of this.relatedColumnWebhookManager) {
      for (const [_tableId, relatedManager] of actionMap) {
        relatedManager.emit();
      }
    }
  }

  emit() {
    // if modelWebhookManager exists, we do not emit
    if (!this.emitted && !this.params.modelWebhookManager) {
      // if no changes on the column, do not emit
      const emitData = {
        prevData: this.params.oldColumns,
        newData: this.params.newColumns,
      };
      if (this.params.action === WebhookActions.UPDATE) {
        const { newColumns, oldColumns } = this.getDiffCols(
          this.params.oldColumns,
          this.params.newColumns,
        );
        emitData.prevData = oldColumns;
        emitData.newData = newColumns;
      }
      if (!emitData.prevData?.length && !emitData.newData?.length) {
        return;
      }

      console.log({
        hookName: `${WebhookEvents.FIELD}.${this.params.action}`,
        ...emitData,
        modelId: this.params.modelId,
      });
      Noco.eventEmitter.emit(HANDLE_WEBHOOK, {
        context: this.context,
        hookName: `${WebhookEvents.FIELD}.${this.params.action}`,
        ...emitData,
        user: this.context.user,
        modelId: this.params.modelId,
      });
      this.emitted = true;
      this.emitRelated();
    }
  }
}
