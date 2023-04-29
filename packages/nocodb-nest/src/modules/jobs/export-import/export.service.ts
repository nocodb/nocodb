import { Readable } from 'stream';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import { unparse } from 'papaparse';
import { Injectable } from '@nestjs/common';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import { getViewAndModelByAliasOrId } from '../../../modules/datas/helpers';
import {
  clearPrefix,
  generateBaseIdMap,
} from '../../../helpers/exportImportHelpers';
import NcPluginMgrv2 from '../../../helpers/NcPluginMgrv2';
import { NcError } from '../../../helpers/catchError';
import { Base, Model, Project } from '../../../models';
import { DatasService } from '../../../services/datas.service';
import type { BaseModelSqlv2 } from '../../../db/BaseModelSqlv2';
import type { LinkToAnotherRecordColumn, View } from '../../../models';

@Injectable()
export class ExportService {
  constructor(private datasService: DatasService) {}

  async serializeModels(param: { modelIds: string[] }) {
    const { modelIds } = param;

    const serializedModels = [];

    // db id to structured id
    const idMap = new Map<string, string>();

    const projects: Project[] = [];
    const bases: Base[] = [];
    const modelsMap = new Map<string, Model[]>();

    for (const modelId of modelIds) {
      const model = await Model.get(modelId);

      if (!model)
        return NcError.badRequest(`Model not found for id '${modelId}'`);

      const fndProject = projects.find((p) => p.id === model.project_id);
      const project = fndProject || (await Project.get(model.project_id));

      const fndBase = bases.find((b) => b.id === model.base_id);
      const base = fndBase || (await Base.get(model.base_id));

      if (!fndProject) projects.push(project);
      if (!fndBase) bases.push(base);

      if (!modelsMap.has(base.id)) {
        modelsMap.set(base.id, await generateBaseIdMap(base, idMap));
      }

      await model.getColumns();
      await model.getViews();

      for (const column of model.columns) {
        await column.getColOptions();
        if (column.colOptions) {
          for (const [k, v] of Object.entries(column.colOptions)) {
            switch (k) {
              case 'fk_mm_child_column_id':
              case 'fk_mm_parent_column_id':
              case 'fk_mm_model_id':
              case 'fk_parent_column_id':
              case 'fk_child_column_id':
              case 'fk_related_model_id':
              case 'fk_relation_column_id':
              case 'fk_lookup_column_id':
              case 'fk_rollup_column_id':
                column.colOptions[k] = idMap.get(v as string);
                break;
              case 'options':
                for (const o of column.colOptions['options']) {
                  delete o.id;
                  delete o.fk_column_id;
                }
                break;
              case 'formula':
                column.colOptions[k] = column.colOptions[k].replace(
                  /(?<=\{\{).*?(?=\}\})/gm,
                  (match) => idMap.get(match),
                );
                break;
              case 'id':
              case 'created_at':
              case 'updated_at':
              case 'fk_column_id':
                delete column.colOptions[k];
                break;
            }
          }
        }
      }

      for (const view of model.views) {
        idMap.set(view.id, `${idMap.get(model.id)}::${view.id}`);
        await view.getColumns();
        await view.getFilters();
        await view.getSorts();
        if (view.filter) {
          const export_filters = [];
          for (const fl of view.filter.children) {
            const tempFl = {
              id: `${idMap.get(view.id)}::${fl.id}`,
              fk_column_id: idMap.get(fl.fk_column_id),
              fk_parent_id: fl.fk_parent_id,
              is_group: fl.is_group,
              logical_op: fl.logical_op,
              comparison_op: fl.comparison_op,
              comparison_sub_op: fl.comparison_sub_op,
              value: fl.value,
            };
            if (tempFl.is_group) {
              delete tempFl.comparison_op;
              delete tempFl.comparison_sub_op;
              delete tempFl.value;
            }
            export_filters.push(tempFl);
          }
          view.filter.children = export_filters;
        }

        if (view.sorts) {
          const export_sorts = [];
          for (const sr of view.sorts) {
            const tempSr = {
              fk_column_id: idMap.get(sr.fk_column_id),
              direction: sr.direction,
            };
            export_sorts.push(tempSr);
          }
          view.sorts = export_sorts;
        }

        if (view.view) {
          for (const [k, v] of Object.entries(view.view)) {
            switch (k) {
              case 'fk_column_id':
              case 'fk_cover_image_col_id':
              case 'fk_grp_col_id':
                view.view[k] = idMap.get(v as string);
                break;
              case 'meta':
                if (view.type === ViewTypes.KANBAN) {
                  const meta = JSON.parse(view.view.meta as string) as Record<
                    string,
                    any
                  >;
                  for (const [k, v] of Object.entries(meta)) {
                    const colId = idMap.get(k as string);
                    for (const op of v) {
                      op.fk_column_id = idMap.get(op.fk_column_id);
                      delete op.id;
                    }
                    meta[colId] = v;
                    delete meta[k];
                  }
                  view.view.meta = meta;
                }
                break;
              case 'created_at':
              case 'updated_at':
              case 'fk_view_id':
              case 'project_id':
              case 'base_id':
              case 'uuid':
                delete view.view[k];
                break;
            }
          }
        }
      }

      serializedModels.push({
        entity: 'model',
        model: {
          id: idMap.get(model.id),
          prefix: project.prefix,
          title: model.title,
          table_name: clearPrefix(model.table_name, project.prefix),
          meta: model.meta,
          columns: model.columns.map((column) => ({
            id: idMap.get(column.id),
            ai: column.ai,
            column_name: column.column_name,
            cc: column.cc,
            cdf: column.cdf,
            meta: column.meta,
            pk: column.pk,
            pv: column.pv,
            order: column.order,
            rqd: column.rqd,
            system: column.system,
            uidt: column.uidt,
            title: column.title,
            un: column.un,
            unique: column.unique,
            colOptions: column.colOptions,
          })),
        },
        views: model.views.map((view) => ({
          id: idMap.get(view.id),
          is_default: view.is_default,
          type: view.type,
          meta: view.meta,
          order: view.order,
          title: view.title,
          show: view.show,
          show_system_fields: view.show_system_fields,
          filter: view.filter,
          sorts: view.sorts,
          lock_type: view.lock_type,
          columns: view.columns.map((column) => {
            const {
              id,
              fk_view_id,
              fk_column_id,
              project_id,
              base_id,
              created_at,
              updated_at,
              uuid,
              ...rest
            } = column as any;
            return {
              fk_column_id: idMap.get(fk_column_id),
              ...rest,
            };
          }),
          view: view.view,
        })),
      });
    }

    return serializedModels;
  }

  async streamModelData(param: {
    dataStream: Readable;
    linkStream: Readable;
    projectId: string;
    modelId: string;
    viewId?: string;
    handledMmList?: string[];
  }) {
    const { dataStream, linkStream, handledMmList } = param;

    const { model, view } = await getViewAndModelByAliasOrId({
      projectName: param.projectId,
      tableName: param.modelId,
      viewName: param.viewId,
    });

    const base = await Base.get(model.base_id);

    await model.getColumns();

    const pkMap = new Map<string, string>();

    const fields = model.columns
      .filter((c) => c.colOptions?.type !== 'hm' && c.colOptions?.type !== 'mm')
      .map((c) => c.title)
      .join(',');

    for (const column of model.columns.filter(
      (col) =>
        col.uidt === UITypes.LinkToAnotherRecord &&
        col.colOptions?.type !== 'hm',
    )) {
      const relatedTable = await (
        (await column.getColOptions()) as LinkToAnotherRecordColumn
      ).getRelatedTable();

      await relatedTable.getColumns();

      pkMap.set(column.id, relatedTable.primaryKey.title);
    }

    const mmColumns = model.columns.filter(
      (col) =>
        col.uidt === UITypes.LinkToAnotherRecord &&
        col.colOptions?.type === 'mm',
    );

    const hasLink = mmColumns.length > 0;

    dataStream.setEncoding('utf8');

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const formatData = (data: any) => {
      for (const row of data) {
        for (const [k, v] of Object.entries(row)) {
          const col = model.columns.find((c) => c.title === k);
          if (col) {
            const colId = `${col.project_id}::${col.base_id}::${col.fk_model_id}::${col.id}`;
            switch (col.uidt) {
              case UITypes.LinkToAnotherRecord:
                {
                  if (col.system || col.colOptions.type !== 'bt') break;

                  if (v) {
                    for (const [k, val] of Object.entries(v)) {
                      if (k === pkMap.get(col.id)) {
                        row[colId] = val;
                      }
                    }
                  }
                }
                break;
              case UITypes.Attachment:
                try {
                  row[colId] = JSON.stringify(v);
                } catch (e) {
                  row[colId] = v;
                }
                break;
              case UITypes.ForeignKey:
              case UITypes.Formula:
              case UITypes.Lookup:
              case UITypes.Rollup:
              case UITypes.Barcode:
              case UITypes.QrCode:
                // skip these types
                break;
              default:
                row[colId] = v;
                break;
            }
            delete row[k];
          }
        }
      }
      return { data };
    };

    const limit = 200;
    const offset = 0;

    try {
      await this.recursiveRead(
        formatData,
        baseModel,
        dataStream,
        model,
        view,
        offset,
        limit,
        fields,
        true,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }

    if (hasLink) {
      linkStream.setEncoding('utf8');

      for (const mm of mmColumns) {
        if (handledMmList.includes(mm.colOptions?.fk_mm_model_id)) continue;

        const mmModel = await Model.get(mm.colOptions?.fk_mm_model_id);

        await mmModel.getColumns();

        const childColumn = mmModel.columns.find(
          (col) => col.id === mm.colOptions?.fk_mm_child_column_id,
        );

        const parentColumn = mmModel.columns.find(
          (col) => col.id === mm.colOptions?.fk_mm_parent_column_id,
        );

        const childColumnTitle = childColumn.title;
        const parentColumnTitle = parentColumn.title;

        const mmFields = mmModel.columns
          .filter((c) => c.uidt === UITypes.ForeignKey)
          .map((c) => c.title)
          .join(',');

        const mmFormatData = (data: any) => {
          data.map((d) => {
            d.column = mm.id;
            d.child = d[childColumnTitle];
            d.parent = d[parentColumnTitle];
            delete d[childColumnTitle];
            delete d[parentColumnTitle];
            return d;
          });
          return { data };
        };

        const mmLimit = 200;
        const mmOffset = 0;

        const mmBase =
          mmModel.base_id === base.id ? base : await Base.get(mmModel.base_id);

        const mmBaseModel = await Model.getBaseModelSQL({
          id: mmModel.id,
          dbDriver: await NcConnectionMgrv2.get(mmBase),
        });

        try {
          await this.recursiveLinkRead(
            mmFormatData,
            mmBaseModel,
            linkStream,
            mmModel,
            undefined,
            mmOffset,
            mmLimit,
            mmFields,
            true,
          );
        } catch (e) {
          console.error(e);
          throw e;
        }

        handledMmList.push(mm.colOptions?.fk_mm_model_id);
      }

      linkStream.push(null);
    } else {
      linkStream.push(null);
    }
  }

  async recursiveRead(
    formatter: (data: any) => { data: any },
    baseModel: BaseModelSqlv2,
    stream: Readable,
    model: Model,
    view: View,
    offset: number,
    limit: number,
    fields: string,
    header = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.datasService
        .getDataList({
          model,
          view,
          query: { limit, offset, fields },
          baseModel,
        })
        .then((result) => {
          try {
            if (!header) {
              stream.push('\r\n');
            }
            const { data } = formatter(result.list);
            stream.push(unparse(data, { header }));
            if (result.pageInfo.isLastPage) {
              stream.push(null);
              resolve();
            } else {
              this.recursiveRead(
                formatter,
                baseModel,
                stream,
                model,
                view,
                offset + limit,
                limit,
                fields,
              ).then(resolve);
            }
          } catch (e) {
            reject(e);
          }
        });
    });
  }

  async recursiveLinkRead(
    formatter: (data: any) => { data: any },
    baseModel: BaseModelSqlv2,
    linkStream: Readable,
    model: Model,
    view: View,
    offset: number,
    limit: number,
    fields: string,
    header = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.datasService
        .getDataList({
          model,
          view,
          query: { limit, offset, fields },
          baseModel,
        })
        .then((result) => {
          try {
            if (!header) {
              linkStream.push('\r\n');
            }
            const { data } = formatter(result.list);
            if (data) linkStream.push(unparse(data, { header }));
            if (result.pageInfo.isLastPage) {
              resolve();
            } else {
              this.recursiveLinkRead(
                formatter,
                baseModel,
                linkStream,
                model,
                view,
                offset + limit,
                limit,
                fields,
              ).then(resolve);
            }
          } catch (e) {
            reject(e);
          }
        });
    });
  }

  async exportBase(param: { path: string; baseId: string }) {
    const base = await Base.get(param.baseId);

    if (!base)
      throw NcError.badRequest(`Base not found for id '${param.baseId}'`);

    const project = await Project.get(base.project_id);

    const models = (await base.getModels()).filter(
      (m) => !m.mm && m.type === 'table',
    );

    const exportedModels = await this.serializeModels({
      modelIds: models.map((m) => m.id),
    });

    const exportData = {
      id: `${project.id}::${base.id}`,
      entity: 'base',
      models: exportedModels,
    };

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    const destPath = `export/${project.id}/${base.id}/${param.path}`;

    try {
      const readableStream = new Readable({
        read() {},
      });

      readableStream.setEncoding('utf8');

      readableStream.push(JSON.stringify(exportData));

      readableStream.push(null);

      await storageAdapter.fileCreateByStream(
        `${destPath}/schema.json`,
        readableStream,
      );

      for (const model of models) {
        const dataStream = new Readable({
          read() {},
        });

        const linkStream = new Readable({
          read() {},
        });

        const uploadPromise = storageAdapter.fileCreateByStream(
          `${param.path}/data/${model.id}.csv`,
          dataStream,
        );

        const uploadLinkPromise = storageAdapter.fileCreateByStream(
          `${param.path}/data/${model.id}_links.csv`,
          linkStream,
        );

        this.streamModelData({
          dataStream,
          linkStream,
          projectId: project.id,
          modelId: model.id,
        });

        await Promise.all([uploadPromise, uploadLinkPromise]);
      }
    } catch (e) {
      throw NcError.badRequest(e);
    }

    return {
      path: destPath,
    };
  }
}
