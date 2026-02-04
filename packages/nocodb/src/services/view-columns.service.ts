import { Injectable } from '@nestjs/common';
import {
  APIContext,
  AppEvents,
  EventType,
  NcBaseError,
  ViewTypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import { bulkUpdateViewColumns } from 'src/models/View/bulkUpdateViewColumns';
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
import { validatePayload, validatePayloadArr } from '~/helpers';
import { CalendarViewColumn, Column, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import { ViewWebhookManagerBuilder } from '~/utils/view-webhook-manager';

const validationSchemaMap = new Map<ViewTypes, string>([
  [ViewTypes.GRID, 'swagger.json#/components/schemas/GridColumnReq'],
  [ViewTypes.GALLERY, 'swagger.json#/components/schemas/GalleryColumnReq'],
  [ViewTypes.KANBAN, 'swagger.json#/components/schemas/KanbanColumnReq'],
  [ViewTypes.FORM, 'swagger.json#/components/schemas/FormColumnReq'],
  [ViewTypes.MAP, 'swagger.json#/components/schemas/MapColumn'],
  [ViewTypes.CALENDAR, 'swagger.json#/components/schemas/CalendarColumnReq'],
]);

@Injectable()
export class ViewColumnsService {
  private logger = new Logger(ViewColumnsService.name);
  constructor(private appHooksService: AppHooksService) {}

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

    let viewWebhookManager: ViewWebhookManager;
    if (!param.viewWebhookManager) {
      const view = await View.get(context, param.viewId, ncMeta);
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
    // this.appHooksService.emit(AppEvents.VIEW_COLUMN_CREATE, {
    //   viewColumn,
    //   req: param.req,
    //   context,
    // });

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

    const view = await View.get(context, param.viewId, ncMeta);

    if (!view) {
      NcError.get(context).viewNotFound(param.viewId);
    }

    const oldViewColumn = await View.getColumn(
      context,
      param.viewId,
      param.columnId,
      ncMeta,
    );

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

    let result: any;
    const ncMeta = await Noco.ncMeta.startTransaction();

    if (!view) {
      NcError.get(context).viewNotFound('View not found');
    }

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

    try {
      // validate the payload array based on view type
      validatePayloadArr(context, {
        schema: validationSchemaMap.get(view.type),
        payload: columns,
      });
      // bulk update view columns and reset cache
      result = await bulkUpdateViewColumns(context, {
        viewId: view.id,
        view: view,
        columns,
      });
      await ncMeta.commit();

      if (viewWebhookManager) {
        (
          await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
        ).emit();
      }

      return result;
    } catch (e) {
      await ncMeta.rollback();
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
