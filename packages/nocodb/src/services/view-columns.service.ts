import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import GridViewColumn from '../models/GridViewColumn';
import GalleryViewColumn from '../models/GalleryViewColumn';
import KanbanViewColumn from '../models/KanbanViewColumn';
import MapViewColumn from '../models/MapViewColumn';
import FormViewColumn from '../models/FormViewColumn';
import type { ViewColumnReqType, ViewColumnUpdateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { View } from '~/models';
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
    columns: ViewColumnReqType[] | Record<string, ViewColumnReqType>;
    req: any;
  }) {
    const { viewId, columns } = param;

    const view = await View.get(viewId);


    const updateOrInsertOptions: Promise<any>[] = [];

    let result: any;
    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      if (!view) {
        NcError.notFound('View not found');
      }

      const table = View.extractViewColumnsTableName(view);

      // iterate over view columns and update/insert accordingly
      for (const [indexOrId, column] of Object.entries(columns)) {
        const columnId =
          typeof param.columns === 'object' ? indexOrId : column.id;

        const existingCol = await ncMeta.metaGet2(null, null, table, {
          fk_view_id: viewId,
          fk_column_id: columnId,
        });

        switch (view.type) {
          case ViewTypes.GRID:
            if (existingCol) {
              updateOrInsertOptions.push(
                GridViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                GridViewColumn.insert({
                  fk_view_id: viewId,
                  fk_column_id: columnId,
                  ...column,
                }, ncMeta),
              );
            }
          case ViewTypes.GALLERY:
            if (existingCol) {
              updateOrInsertOptions.push(
                GalleryViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                GalleryViewColumn.insert({
                  fk_view_id: viewId,
                  fk_column_id: columnId,
                  ...column,
                }, ncMeta),
              );
            }
          case ViewTypes.KANBAN:
            if (existingCol) {
              updateOrInsertOptions.push(
                KanbanViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                KanbanViewColumn.insert({
                  fk_view_id: viewId,
                  fk_column_id: columnId,
                  ...column,
                }, ncMeta),
              );
            }
            break;
          case ViewTypes.MAP:
            if (existingCol) {
              updateOrInsertOptions.push(
                MapViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                MapViewColumn.insert({
                  fk_view_id: viewId,
                  fk_column_id: columnId,
                  ...column,
                }, ncMeta),
              );
            }
            break;
          case ViewTypes.FORM:
            if (existingCol) {
              updateOrInsertOptions.push(
                FormViewColumn.update(existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                FormViewColumn.insert({
                  fk_view_id: viewId,
                  fk_column_id: columnId,
                  ...column,
                }, ncMeta),
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
}
