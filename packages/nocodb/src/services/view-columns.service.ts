import { Injectable } from '@nestjs/common';
import { APIContext, AppEvents, ViewTypes } from 'nocodb-sdk';
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
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { CalendarViewColumn, Column, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';

@Injectable()
export class ViewColumnsService {
  constructor(private appHooksService: AppHooksService) {}

  async columnList(context: NcContext, param: { viewId: string }) {
    return await View.getColumns(context, param.viewId, undefined);
  }

  async columnAdd(
    context: NcContext,
    param: {
      viewId: string;
      column: ViewColumnReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewColumnReq',
      param.column,
    );

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
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewColumnUpdateReq',
      param.column,
    );

    const view = await View.get(context, param.viewId);

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    const oldViewColumn = await View.getColumn(
      context,
      param.viewId,
      param.columnId,
    );

    const column = await Column.get(context, {
      colId: oldViewColumn.fk_column_id,
    });

    const result = await View.updateColumn(
      context,
      param.viewId,
      param.columnId,
      param.column,
    );

    const viewColumn = await View.getColumn(
      context,
      param.viewId,
      param.columnId,
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
    },
  ) {
    const { viewId } = param;

    const columns = Array.isArray(param.columns)
      ? param.columns
      : param.columns?.[APIContext.VIEW_COLUMNS];

    if (!columns) {
      NcError.badRequest('Invalid request - fields not found');
    }

    const view = await View.get(context, viewId);

    const updateOrInsertOptions: Promise<any>[] = [];

    let result: any;
    const ncMeta = await Noco.ncMeta.startTransaction();

    if (!view) {
      NcError.notFound('View not found');
    }

    try {
      const table = View.extractViewColumnsTableName(view);

      // iterate over view columns and update/insert accordingly
      for (const [indexOrId, column] of Object.entries(columns)) {
        const columnId =
          typeof param.columns === 'object' ? indexOrId : column['id'];

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
              updateOrInsertOptions.push(
                GridViewColumn.update(context, existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                GridViewColumn.insert(
                  context,
                  {
                    ...(column as GridColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.GALLERY:
            validatePayload(
              'swagger.json#/components/schemas/GalleryColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                GalleryViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                ),
              );
            } else {
              updateOrInsertOptions.push(
                GalleryViewColumn.insert(
                  context,
                  {
                    ...(column as GalleryColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.KANBAN:
            validatePayload(
              'swagger.json#/components/schemas/KanbanColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                KanbanViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                ),
              );
            } else {
              updateOrInsertOptions.push(
                KanbanViewColumn.insert(
                  context,
                  {
                    ...(column as KanbanColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.MAP:
            validatePayload(
              'swagger.json#/components/schemas/MapColumn',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                MapViewColumn.update(context, existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                MapViewColumn.insert(
                  context,
                  {
                    ...(column as MapViewColumn),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.FORM:
            validatePayload(
              'swagger.json#/components/schemas/FormColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                FormViewColumn.update(context, existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                FormViewColumn.insert(
                  context,
                  {
                    ...(column as FormColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.CALENDAR:
            validatePayload(
              'swagger.json#/components/schemas/CalendarColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                CalendarViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                ),
              );
            } else {
              updateOrInsertOptions.push(
                CalendarViewColumn.insert(
                  context,
                  {
                    ...(column as CalendarColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
        }
      }

      await Promise.all(updateOrInsertOptions);

      await ncMeta.commit();

      await View.clearSingleQueryCache(context, view.fk_model_id, [view]);

      return result;
    } catch (e) {
      await ncMeta.rollback();
      throw e;
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
