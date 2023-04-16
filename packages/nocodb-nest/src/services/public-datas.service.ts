import path from 'path';
import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { ErrorMessages, UITypes, ViewTypes } from 'nocodb-sdk';
import slash from 'slash';
import { nocoExecute } from 'nc-help';
import { Base, Column, Model, View } from '../models';

import { NcError } from '../helpers/catchError';
import getAst from '../helpers/getAst';
import NcPluginMgrv2 from '../helpers/NcPluginMgrv2';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import { mimeIcons } from '../utils/mimeTypes';
import { getColumnByIdOrName } from '../modules/datas/helpers';
import type { LinkToAnotherRecordColumn } from '../models';

// todo: move to utils
export function sanitizeUrlPath(paths) {
  return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
}

@Injectable()
export class PublicDatasService {
  async dataList(param: {
    sharedViewUuid: string;
    password?: string;
    query: any;
  }) {
    const view = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.notFound('Not found');
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP
    ) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== param.password) {
      return NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id,
    });

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const listArgs: any = { ...param.query };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    let data = [];
    let count = 0;

    try {
      const { ast } = await getAst({
        query: param.query,
        model,
        view,
      });

      data = await nocoExecute(
        ast,
        await baseModel.list(listArgs),
        {},
        listArgs,
      );
      count = await baseModel.count(listArgs);
    } catch (e) {
      console.log(e);
      // show empty result instead of throwing error here
      // e.g. search some text in a numeric field

      NcError.internalServerError('Please try after some time');
    }

    return new PagedResponseImpl(data, { ...param.query, count });
  }

  // todo: Handle the error case where view doesnt belong to model
  async groupedDataList(param: {
    sharedViewUuid: string;
    password?: string;
    query: any;
    groupColumnId: string;
  }) {
    const view = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.notFound('Not found');

    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY
    ) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== param.password) {
      return NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id,
    });

    return await this.getGroupedDataList({
      model,
      view,
      query: param.query,
      groupColumnId: param.groupColumnId,
    });
  }

  async getGroupedDataList(param: {
    model: Model;
    view: View;
    query: any;
    groupColumnId: string;
  }) {
    const { model, view, query = {}, groupColumnId } = param;
    const base = await Base.get(param.model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const { ast } = await getAst({ model, query: param.query, view });

    const listArgs: any = { ...query };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}
    try {
      listArgs.options = JSON.parse(listArgs.optionsArrJson);
    } catch (e) {}

    let data = [];

    try {
      const groupedData = await baseModel.groupedList({
        ...listArgs,
        groupColumnId,
      });
      data = await nocoExecute(
        { key: 1, value: ast },
        groupedData,
        {},
        listArgs,
      );
      const countArr = await baseModel.groupedListCount({
        ...listArgs,
        groupColumnId,
      });
      data = data.map((item) => {
        // todo: use map to avoid loop
        const count =
          countArr.find((countItem: any) => countItem.key === item.key)
            ?.count ?? 0;

        item.value = new PagedResponseImpl(item.value, {
          ...query,
          count: count,
        });
        return item;
      });
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Internal Server Error');
    }
    return data;
  }

  async dataInsert(param: {
    sharedViewUuid: string;
    password?: string;
    body: any;
    files: any[];
    siteUrl: string;
  }) {
    const view = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.notFound();
    if (view.type !== ViewTypes.FORM) NcError.notFound();

    if (view.password && view.password !== param.password) {
      return NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id,
    });

    const base = await Base.get(model.base_id);
    const project = await base.getProject();

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    await view.getViewWithInfo();
    await view.getColumns();
    await view.getModelWithInfo();
    await view.model.getColumns();

    const fields = (view.model.columns = view.columns
      .filter((c) => c.show)
      .reduce((o, c) => {
        o[view.model.columnsById[c.fk_column_id].title] = new Column({
          ...c,
          ...view.model.columnsById[c.fk_column_id],
        } as any);
        return o;
      }, {}) as any);

    let body = param?.body;

    if (typeof body === 'string') body = JSON.parse(body);

    const insertObject = Object.entries(body).reduce((obj, [key, val]) => {
      if (key in fields) {
        obj[key] = val;
      }
      return obj;
    }, {});

    const attachments = {};
    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    for (const file of param.files || []) {
      // remove `_` prefix and `[]` suffix
      const fieldName = file?.fieldname?.replace(/^_|\[\d*]$/g, '');

      const filePath = sanitizeUrlPath([
        'noco',
        project.title,
        model.title,
        fieldName,
      ]);

      if (
        fieldName in fields &&
        fields[fieldName].uidt === UITypes.Attachment
      ) {
        attachments[fieldName] = attachments[fieldName] || [];
        const fileName = `${nanoid(18)}${path.extname(file.originalname)}`;

        const url = await storageAdapter.fileCreate(
          slash(path.join('nc', 'uploads', ...filePath, fileName)),
          file,
        );
        let attachmentPath;

        // if `url` is null, then it is local attachment
        if (!url) {
          // then store the attachment path only
          // url will be constructed in `useAttachmentCell`
          attachmentPath = `download/${filePath.join('/')}/${fileName}`;
        }

        attachments[fieldName].push({
          ...(url ? { url } : {}),
          ...(attachmentPath ? { path: attachmentPath } : {}),
          title: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          icon:
            mimeIcons[path.extname(file.originalname).slice(1)] || undefined,
        });
      }
    }

    for (const [column, data] of Object.entries(attachments)) {
      insertObject[column] = JSON.stringify(data);
    }

    return await baseModel.nestedInsert(insertObject, null);
  }

  async relDataList(param: {
    query: any;
    sharedViewUuid: string;
    password?: string;
    columnId: string;
  }) {
    const view = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.notFound('Not found');

    if (view.type !== ViewTypes.FORM) NcError.notFound('Not found');

    if (view.password && view.password !== param.password) {
      NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    const column = await Column.get({ colId: param.columnId });
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const model = await colOptions.getRelatedTable();

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const { ast } = await getAst({
      query: param.query,
      model,
      extractOnlyPrimaries: true,
    });

    let data = [];
    let count = 0;
    try {
      data = data = await nocoExecute(
        ast,
        await baseModel.list(param.query),
        {},
        param.query,
      );
      count = await baseModel.count(param.query);
    } catch (e) {
      // show empty result instead of throwing error here
      // e.g. search some text in a numeric field
    }

    return new PagedResponseImpl(data, { ...param.query, count });
  }

  async publicMmList(param: {
    query: any;
    sharedViewUuid: string;
    password?: string;
    columnId: string;
    rowId: string;
  }) {
    const view = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.notFound('Not found');
    if (view.type !== ViewTypes.GRID) NcError.notFound('Not found');

    if (view.password && view.password !== param.password) {
      NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    const column = await getColumnByIdOrName(
      param.columnId,
      await view.getModel(),
    );

    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    const base = await Base.get(view.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const key = `List`;
    const requestObj: any = {
      [key]: 1,
    };

    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.mmList(
              {
                colId: param.columnId,
                parentId: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    const count: any = await baseModel.mmListCount({
      colId: param.columnId,
      parentId: param.rowId,
    });

    return new PagedResponseImpl(data, { ...param.query, count });
  }

  async publicHmList(param: {
    query: any;
    rowId: string;
    sharedViewUuid: string;
    password?: string;
    columnId: string;
  }) {
    const view = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.notFound('Not found');
    if (view.type !== ViewTypes.GRID) NcError.notFound('Not found');

    if (view.password && view.password !== param.password) {
      NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    const column = await getColumnByIdOrName(
      param.columnId,
      await view.getModel(),
    );

    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    const base = await Base.get(view.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const key = `List`;
    const requestObj: any = {
      [key]: 1,
    };

    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.hmList(
              {
                colId: param.columnId,
                id: param.rowId,
              },
              args,
            );
          },
        },
        {},
        { nested: { [key]: param.query } },
      )
    )?.[key];

    const count = await baseModel.hmListCount({
      colId: param.columnId,
      id: param.rowId,
    });

    return new PagedResponseImpl(data, { ...param.query, count });
  }
}
