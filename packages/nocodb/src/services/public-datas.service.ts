import path from 'path';
import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { populateUniqueFileName, UITypes, ViewTypes } from 'nocodb-sdk';
import slash from 'slash';
import { nocoExecute } from 'nc-help';

import type { LinkToAnotherRecordColumn } from '~/models';
import { Column, Model, Source, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { getColumnByIdOrName } from '~/modules/datas/helpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { mimeIcons } from '~/utils/mimeTypes';
import { utf8ify } from '~/helpers/stringHelpers';

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
    const { sharedViewUuid, password, query = {} } = param;
    const view = await View.getByUUID(sharedViewUuid);

    if (!view) NcError.viewNotFound(sharedViewUuid);
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP &&
      view.type !== ViewTypes.CALENDAR
    ) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== password) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id,
    });

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const { ast, dependencyFields } = await getAst({
      model,
      query: {},
      view,
    });

    const listArgs: any = { ...query, ...dependencyFields };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}
    let data = [];
    let count = 0;

    try {
      data = await nocoExecute(
        ast,
        await baseModel.list(listArgs),
        {},
        listArgs,
      );
      count = await baseModel.count(listArgs);
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
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

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY
    ) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
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
    const source = await Source.get(param.model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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
      NcError.internalServerError('Please check server log for more details');
    }
    return data;
  }

  async dataGroupBy(param: {
    sharedViewUuid: string;
    password?: string;
    query: any;
  }) {
    const view = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.type !== ViewTypes.GRID) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id,
    });

    return await this.getDataGroupBy({ model, view, query: param.query });
  }

  async getDataGroupBy(param: { model: Model; view: View; query?: any }) {
    try {
      const { model, view, query = {} } = param;

      const source = await Source.get(model.source_id);

      const baseModel = await Model.getBaseModelSQL({
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
      });

      const listArgs: any = { ...query };

      try {
        listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
      } catch (e) {}
      try {
        listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
      } catch (e) {}

      const data = await baseModel.groupBy(listArgs);
      const count = await baseModel.groupByCount(listArgs);

      return new PagedResponseImpl(data, {
        ...query,
        count,
      });
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }
  }

  async dataInsert(param: {
    sharedViewUuid: string;
    password?: string;
    body: any;
    files: any[];
    siteUrl: string;
  }) {
    const view = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);
    if (view.type !== ViewTypes.FORM) NcError.notFound();

    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id,
    });

    const source = await Source.get(model.source_id);
    const base = await source.getProject();

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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
        base.title,
        model.title,
        fieldName,
      ]);

      if (
        fieldName in fields &&
        fields[fieldName].uidt === UITypes.Attachment
      ) {
        attachments[fieldName] = attachments[fieldName] || [];
        let originalName = utf8ify(file.originalname);

        originalName = populateUniqueFileName(
          originalName,
          attachments[fieldName].map((att) => att?.title),
        );

        const fileName = `${nanoid(18)}${path.extname(originalName)}`;

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
          title: originalName,
          mimetype: file.mimetype,
          size: file.size,
          icon: mimeIcons[path.extname(originalName).slice(1)] || undefined,
        });
      }
    }

    // filter the uploadByUrl attachments
    const uploadByUrlAttachments = [];
    for (const [column, data] of Object.entries(insertObject)) {
      if (fields[column].uidt === UITypes.Attachment && Array.isArray(data)) {
        data.forEach((file, uploadIndex) => {
          if (file?.url && !file?.file) {
            uploadByUrlAttachments.push({
              ...file,
              fieldName: column,
              uploadIndex,
            });
          }
        });
      }
    }

    for (const file of uploadByUrlAttachments) {
      const filePath = sanitizeUrlPath([
        'noco',
        base.title,
        model.title,
        file.fieldName,
      ]);

      attachments[file.fieldName] = attachments[file.fieldName] || [];

      const fileName = `${nanoid(18)}${path.extname(
        file?.fileName || file.url.split('/').pop(),
      )}`;

      const attachmentUrl: string | null = await storageAdapter.fileCreateByUrl(
        slash(path.join('nc', 'uploads', ...filePath, fileName)),
        file.url,
      );

      let attachmentPath: string | undefined;

      // if `attachmentUrl` is null, then it is local attachment
      if (!attachmentUrl) {
        // then store the attachment path only
        // url will be constructed in `useAttachmentCell`
        attachmentPath = `download/${filePath.join('/')}/${fileName}`;
      }

      // add attachement in uploaded order
      attachments[file.fieldName].splice(
        file.uploadIndex ?? attachments[file.fieldName].length,
        0,
        {
          ...(attachmentUrl ? { url: attachmentUrl } : {}),
          ...(attachmentPath ? { path: attachmentPath } : {}),
          title: file.fileName,
          mimetype: file.mimetype,
          size: file.size,
          icon: mimeIcons[path.extname(fileName).slice(1)] || undefined,
        },
      );
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

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.type !== ViewTypes.FORM && view.type !== ViewTypes.GALLERY) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== param.password) {
      NcError.invalidSharedViewPassword();
    }

    const column = await Column.get({ colId: param.columnId });
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const model = await colOptions.getRelatedTable();

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const { ast, dependencyFields } = await getAst({
      query: param.query,
      model,
      extractOnlyPrimaries: true,
    });

    let data = [];

    let count = 0;

    try {
      data = data = await nocoExecute(
        ast,
        await baseModel.list(dependencyFields),
        {},
        dependencyFields,
      );
      count = await baseModel.count(dependencyFields as any);
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
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

    if (!view) NcError.viewNotFound(param.sharedViewUuid);
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.CALENDAR
    ) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== param.password) {
      NcError.invalidSharedViewPassword();
    }

    const column = await getColumnByIdOrName(
      param.columnId,
      await view.getModel(),
    );

    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    const source = await Source.get(view.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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

    const count: any = await baseModel.mmListCount(
      {
        colId: param.columnId,
        parentId: param.rowId,
      },
      param.query,
    );

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

    if (!view) NcError.viewNotFound(param.sharedViewUuid);
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.CALENDAR
    ) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== param.password) {
      NcError.invalidSharedViewPassword();
    }

    const column = await getColumnByIdOrName(
      param.columnId,
      await view.getModel(),
    );

    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    const source = await Source.get(view.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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

    const count = await baseModel.hmListCount(
      {
        colId: param.columnId,
        id: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, { ...param.query, count });
  }
}
