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
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { CalendarViewColumn, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';

@Injectable()
export class ViewColumnsService {
  constructor(private appHooksService: AppHooksService) {}

  async columnList(param: { viewId: string }) {
    return await View.getColumns(param.viewId, undefined);
  }

  async columnAdd(param: {
    viewId: string;
    column: ViewColumnReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewColumnReq',
      param.column,
    );

    const viewColumn = await View.insertOrUpdateColumn(
      param.viewId,
      param.column.fk_column_id,
      {
        order: param.column.order,
        show: param.column.show,
      },
    );
    this.appHooksService.emit(AppEvents.VIEW_COLUMN_CREATE, {
      viewColumn,
      req: param.req,
    });

    return viewColumn;
  }

  async columnUpdate(param: {
    viewId: string;
    columnId: string;
    column: ViewColumnUpdateReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewColumnUpdateReq',
      param.column,
    );

    const result = await View.updateColumn(
      param.viewId,
      param.columnId,
      param.column,
    );

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      viewColumn: param.column,
      req: param.req,
    });

    return result;
  }

  async columnsUpdate(param: {
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
  }) {
    const { viewId } = param;

    const columns = Array.isArray(param.columns)
      ? param.columns
      : param.columns?.[APIContext.VIEW_COLUMNS];

    if (!columns) {
      NcError.badRequest('Invalid request - fields not found');
    }

    const view = await View.get(viewId);

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

        const existingCol = await ncMeta.metaGet2(null, null, table, {
          fk_view_id: viewId,
          fk_column_id: columnId,
        });

        switch (view.type) {
          case ViewTypes.GRID:
            validatePayload(
              'swagger.json#/components/schemas/GridColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                GridViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                GridViewColumn.insert(
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
                GalleryViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                GalleryViewColumn.insert(
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
                KanbanViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                KanbanViewColumn.insert(
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
                MapViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                MapViewColumn.insert(
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
                FormViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                FormViewColumn.insert(
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
                CalendarViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                CalendarViewColumn.insert(
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

      await View.clearSingleQueryCache(view.fk_model_id, [view]);

      return result;
    } catch (e) {
      await ncMeta.rollback();
      throw e;
    }
  }

  async viewColumnList(param: { viewId: string; req: any }) {
    const columnList = await View.getColumns(param.viewId, undefined);

    // generate key-value pair of column id and column
    const columnMap = columnList.reduce((acc, column) => {
      acc[column.fk_column_id] = column;
      return acc;
    }, {});

    return columnMap;
  }
}
