import { Injectable } from '@nestjs/common';
import {
  APIContext,
  AppEvents,
  EventType,
  NcBaseError,
  ViewTypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import GridViewColumn from '../models/GridViewColumn';
import GalleryViewColumn from '../models/GalleryViewColumn';
import KanbanViewColumn from '../models/KanbanViewColumn';
import MapViewColumn from '../models/MapViewColumn';
import FormViewColumn from '../models/FormViewColumn';
import type {
  CalendarColumnReqType,
  FormColumnReqType,
  GalleryColumnReqType,
  GridColumnReqType,
  KanbanColumnReqType,
  ViewColumnReqType,
  ViewColumnUpdateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import {
  CalendarViewColumn,
  Column,
  GanttViewColumn,
  TimelineViewColumn,
  View,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import { ViewWebhookManagerBuilder } from '~/utils/view-webhook-manager';

@Injectable()
export class ViewColumnsService {
  private logger = new Logger(ViewColumnsService.name);
  constructor(protected appHooksService: AppHooksService) {}

  async columnList(
    context: NcContext,
    param: { viewId: string },
    ncMeta?: MetaService,
  ) {
    return await View.getColumns(context, param.viewId, ncMeta);
  }

  async columnAdd(
    context: NcContext,
    param: {
      viewId: string;
      column: ViewColumnReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewColumnReq',
      param.column,
    );

    const view = await View.get(context, param.viewId, false, ncMeta);

    let viewWebhookManager: ViewWebhookManager;
    if (!param.viewWebhookManager) {
      viewWebhookManager =
        param.viewWebhookManager ??
        (
          await (
            await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
              view.fk_model_id,
            )
          ).withViewId(view.id)
        ).forUpdate();
    }

    const viewColumn = await View.insertOrUpdateColumn(
      context,
      param.viewId,
      param.column.fk_column_id,
      {
        order: param.column.order,
        show: param.column.show,
      },
    );

    const column = await Column.get(
      context,
      { colId: param.column.fk_column_id },
      ncMeta,
    );

    if (view && column) {
      this.appHooksService.emit(AppEvents.VIEW_COLUMN_CREATE, {
        viewColumn,
        view,
        column,
        req: param.req,
        context,
      });
    }

    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }

    return viewColumn;
  }

  async columnUpdate(
    context: NcContext,
    param: {
      viewId: string;
      columnId: string;
      column: ViewColumnUpdateReqType;
      req: NcRequest;
      internal?: boolean;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    validatePayload(
      'swagger.json#/components/schemas/ViewColumnUpdateReq',
      param.column,
    );

    const view = await View.get(context, param.viewId, false, ncMeta);

    if (!view) {
      NcError.get(context).viewNotFound(param.viewId);
    }

    const oldViewColumn = await View.getColumn(
      context,
      param.viewId,
      param.columnId,
      ncMeta,
    );

    if (!oldViewColumn) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    const column = await Column.get(
      context,
      {
        colId: oldViewColumn.fk_column_id,
      },
      ncMeta,
    );

    let viewWebhookManager: ViewWebhookManager;
    if (!param.viewWebhookManager) {
      viewWebhookManager =
        param.viewWebhookManager ??
        (
          await (
            await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
              view.fk_model_id,
            )
          ).withViewId(view.id)
        ).forUpdate();
    }

    const result = await View.updateColumn(
      context,
      param.viewId,
      param.columnId,
      param.column,
      ncMeta,
    );

    const viewColumn = await View.getColumn(
      context,
      param.viewId,
      param.columnId,
      ncMeta,
    );

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      viewColumn,
      oldViewColumn,
      view,
      column,
      internal: param.internal,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_column_update',
          payload: {
            ...oldViewColumn,
            ...viewColumn,
          },
        },
      },
      context.socket_id,
    );

    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }

    return result;
  }

  async columnsUpdate(
    context: NcContext,
    param: {
      viewId: string;
      columns:
        | GridColumnReqType
        | GalleryColumnReqType
        | KanbanColumnReqType
        | FormColumnReqType
        | CalendarColumnReqType[]
        | Record<
            APIContext.VIEW_COLUMNS,
            Record<
              string,
              | GridColumnReqType
              | GalleryColumnReqType
              | KanbanColumnReqType
              | FormColumnReqType
              | CalendarColumnReqType
            >
          >;
      req: any;
      viewWebhookManager?: ViewWebhookManager;
    },
  ) {
    const { viewId } = param;

    const columns = Array.isArray(param.columns)
      ? param.columns
      : param.columns?.[APIContext.VIEW_COLUMNS];

    if (!columns) {
      NcError.get(context).badRequest('Invalid request - fields not found');
    }

    const view = await View.get(context, viewId);

    if (!view) {
      NcError.get(context).viewNotFound('View not found');
    }

    // Build the webhook manager before opening the transaction.
    let viewWebhookManager: ViewWebhookManager;
    if (!param.viewWebhookManager) {
      viewWebhookManager =
        param.viewWebhookManager ??
        (
          await (
            await new ViewWebhookManagerBuilder(context).withModelId(
              view.fk_model_id,
            )
          ).withViewId(view.id)
        ).forUpdate();
    }

    let result: any;

    try {
      await Noco.ncMeta.runInTransaction(async (ncMeta) => {
        const table = View.extractViewColumnsTableName(view);

        // iterate over view columns and update/insert accordingly
        for (const [indexOrId, column] of Object.entries(columns)) {
          const columnId = Array.isArray(param.columns)
            ? column['id']
            : indexOrId;

          const existingCol = await ncMeta.metaGet2(
            context.workspace_id,
            context.base_id,
            table,
            {
              fk_view_id: viewId,
              fk_column_id: columnId,
            },
          );

          switch (view.type) {
            case ViewTypes.GRID:
              validatePayload(
                'swagger.json#/components/schemas/GridColumnReq',
                column,
              );
              if (existingCol) {
                await GridViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                );
              } else {
                await GridViewColumn.insert(
                  context,
                  {
                    ...(column as GridColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                );
              }
              break;
            case ViewTypes.GALLERY:
              validatePayload(
                'swagger.json#/components/schemas/GalleryColumnReq',
                column,
              );
              if (existingCol) {
                await GalleryViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                );
              } else {
                await GalleryViewColumn.insert(
                  context,
                  {
                    ...(column as GalleryColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                );
              }
              break;
            case ViewTypes.KANBAN:
              validatePayload(
                'swagger.json#/components/schemas/KanbanColumnReq',
                column,
              );
              if (existingCol) {
                await KanbanViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                );
              } else {
                await KanbanViewColumn.insert(
                  context,
                  {
                    ...(column as KanbanColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                );
              }
              break;
            case ViewTypes.MAP:
              validatePayload(
                'swagger.json#/components/schemas/MapColumn',
                column,
              );
              if (existingCol) {
                await MapViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                );
              } else {
                await MapViewColumn.insert(
                  context,
                  {
                    ...(column as MapViewColumn),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                );
              }
              break;
            case ViewTypes.FORM:
              validatePayload(
                'swagger.json#/components/schemas/FormColumnReq',
                column,
              );
              if (existingCol) {
                await FormViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                );
              } else {
                await FormViewColumn.insert(
                  context,
                  {
                    ...(column as FormColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                );
              }
              break;
            case ViewTypes.CALENDAR:
              validatePayload(
                'swagger.json#/components/schemas/CalendarColumnReq',
                column,
              );
              if (existingCol) {
                await CalendarViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                );
              } else {
                await CalendarViewColumn.insert(
                  context,
                  {
                    ...(column as CalendarColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                );
              }
              break;
            case ViewTypes.TIMELINE:
              // Timeline shares the Calendar-style column model (show/order +
              // bold/italic/underline). Bulk import via columnsUpdate needs
              // to reach the right column row; without this case, B/I/U +
              // visibility silently get dropped on table duplicate.
              if (existingCol) {
                await TimelineViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                );
              } else {
                await TimelineViewColumn.insert(
                  context,
                  {
                    ...(column as any),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                );
              }
              break;
            case ViewTypes.GANTT:
              // Gantt mirrors Timeline — same column model shape. Same
              // motivation: keep duplicate carrying B/I/U + visibility.
              if (existingCol) {
                await GanttViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                );
              } else {
                await GanttViewColumn.insert(
                  context,
                  {
                    ...(column as any),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                );
              }
              break;
          }
        }
      });

      await View.clearSingleQueryCache(context, view.fk_model_id, [view]);

      if (viewWebhookManager) {
        (
          await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
        ).emit();
      }

      return result;
    } catch (e) {
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error('Error updating view columns', e);
      NcError.get(context).badRequest('Bad Request');
    }
  }

  async viewColumnList(
    context: NcContext,
    param: { viewId: string; req: any },
  ) {
    const columnList = await View.getColumns(context, param.viewId, undefined);

    // generate key-value pair of column id and column
    const columnMap = columnList.reduce((acc, column) => {
      acc[column.fk_column_id] = column;
      return acc;
    }, {});

    return columnMap;
  }
}
