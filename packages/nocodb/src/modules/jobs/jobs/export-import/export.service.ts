import { Readable } from 'stream';
import { isLinksOrLTAR, UITypes, ViewTypes } from 'nocodb-sdk';
import { unparse } from 'papaparse';
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import { elapsedTime, initTime } from '../../helpers';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { View } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { getViewAndModelByAliasOrId } from '~/modules/datas/helpers';
import { clearPrefix, generateBaseIdMap } from '~/helpers/exportImportHelpers';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NcError } from '~/helpers/catchError';
import { DatasService } from '~/services/datas.service';
import { Base, Hook, Model, Source } from '~/models';

@Injectable()
export class ExportService {
  private readonly debugLog = debug('nc:jobs:import');

  constructor(private datasService: DatasService) {}

  async serializeModels(param: {
    modelIds: string[];
    excludeViews?: boolean;
    excludeHooks?: boolean;
    excludeData?: boolean;
  }) {
    const { modelIds } = param;

    const excludeData = param?.excludeData || false;
    const excludeViews = param?.excludeViews || false;
    const excludeHooks = param?.excludeHooks || false;

    const serializedModels = [];

    // db id to structured id
    const idMap = new Map<string, string>();

    const bases: Base[] = [];
    const sources: Source[] = [];
    const modelsMap = new Map<string, Model[]>();

    for (const modelId of modelIds) {
      const model = await Model.get(modelId);

      let pgSerialLastVal;

      if (!model)
        return NcError.badRequest(`Model not found for id '${modelId}'`);

      const fndProject = bases.find((p) => p.id === model.base_id);
      const base = fndProject || (await Base.get(model.base_id));

      const fndBase = sources.find((b) => b.id === model.source_id);
      const source = fndBase || (await Source.get(model.source_id));

      if (!fndProject) bases.push(base);
      if (!fndBase) sources.push(source);

      if (!modelsMap.has(source.id)) {
        modelsMap.set(source.id, await generateBaseIdMap(source, idMap));
      }

      await model.getColumns();
      await model.getViews();

      // if views are excluded, filter all views except default
      if (excludeViews) {
        model.views = model.views.filter((v) => v.is_default);
      }

      for (const column of model.columns) {
        await column.getColOptions();

        // if data is not excluded, get currval for ai column (pg)
        if (!excludeData) {
          if (source.type === 'pg') {
            if (column.ai) {
              try {
                const baseModel = await Model.getBaseModelSQL({
                  id: model.id,
                  viewId: null,
                  dbDriver: await NcConnectionMgrv2.get(source),
                });
                const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
                const seq = await sqlClient.raw(
                  `SELECT pg_get_serial_sequence('??', ?) as seq;`,
                  [baseModel.getTnPath(model.table_name), column.column_name],
                );
                if (seq.rows.length > 0) {
                  const seqName = seq.rows[0].seq;

                  const res = await sqlClient.raw(
                    `SELECT last_value as last FROM ${seqName};`,
                  );

                  if (res.rows.length > 0) {
                    pgSerialLastVal = res.rows[0].last;
                  }
                }
              } catch (e) {
                this.debugLog(e);
              }
            }
          }
        }

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
              case 'base_id':
              case 'source_id':
              case 'uuid':
                delete view.view[k];
                break;
            }
          }
        }
      }

      const serializedHooks = [];

      if (!excludeHooks) {
        const hooks = await Hook.list({ fk_model_id: model.id });

        for (const hook of hooks) {
          idMap.set(hook.id, `${idMap.get(hook.fk_model_id)}::${hook.id}`);

          const hookFilters = await hook.getFilters();
          const export_filters = [];

          if (hookFilters) {
            for (const fl of hookFilters) {
              const tempFl = {
                id: `${idMap.get(hook.id)}::${fl.id}`,
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
          }

          serializedHooks.push({
            id: idMap.get(hook.id),
            title: hook.title,
            active: hook.active,
            condition: hook.condition,
            event: hook.event,
            operation: hook.operation,
            notification: hook.notification,
            version: hook.version,
            filters: export_filters,
          });
        }
      }

      serializedModels.push({
        model: {
          id: idMap.get(model.id),
          prefix: base.prefix,
          title: model.title,
          table_name: clearPrefix(model.table_name, base.prefix),
          pgSerialLastVal,
          meta: model.meta,
          columns: model.columns.map((column) => ({
            id: idMap.get(column.id),
            ai: column.ai,
            column_name: column.column_name,
            cc: column.cc,
            cdf: column.cdf,
            dt: column.dt,
            dtxp: column.dtxp,
            dtxs: column.dtxs,
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
              base_id,
              source_id,
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
        hooks: serializedHooks,
      });
    }

    return serializedModels;
  }

  async streamModelDataAsCsv(param: {
    dataStream: Readable;
    linkStream: Readable;
    baseId: string;
    modelId: string;
    viewId?: string;
    handledMmList?: string[];
    _fieldIds?: string[];
  }) {
    const { dataStream, linkStream, handledMmList } = param;

    const { model, view } = await getViewAndModelByAliasOrId({
      baseName: param.baseId,
      tableName: param.modelId,
      viewName: param.viewId,
    });

    const source = await Source.get(model.source_id);

    await model.getColumns();

    const btMap = new Map<string, string>();

    for (const column of model.columns.filter(
      (col) =>
        col.uidt === UITypes.LinkToAnotherRecord &&
        col.colOptions?.type === 'bt',
    )) {
      await column.getColOptions();
      const fkCol = model.columns.find(
        (c) => c.id === column.colOptions?.fk_child_column_id,
      );
      if (fkCol) {
        // replace bt column with fk column if it is in _fieldIds
        if (param._fieldIds && param._fieldIds.includes(column.id)) {
          param._fieldIds.push(fkCol.id);
          const btIndex = param._fieldIds.indexOf(column.id);
          param._fieldIds.splice(btIndex, 1);
        }

        btMap.set(
          fkCol.id,
          `${column.base_id}::${column.source_id}::${column.fk_model_id}::${column.id}`,
        );
      }
    }

    const fields = param._fieldIds
      ? model.columns
          .filter((c) => param._fieldIds?.includes(c.id))
          .map((c) => c.title)
          .join(',')
      : model.columns
          .filter((c) => !isLinksOrLTAR(c))
          .map((c) => c.title)
          .join(',');

    const mmColumns = model.columns.filter(
      (col) => isLinksOrLTAR(col) && col.colOptions?.type === 'mm',
    );

    const hasLink = mmColumns.length > 0;

    dataStream.setEncoding('utf8');

    const formatData = (data: any) => {
      for (const row of data) {
        for (const [k, v] of Object.entries(row)) {
          const col = model.columns.find((c) => c.title === k);
          if (col) {
            const colId = `${col.base_id}::${col.source_id}::${col.fk_model_id}::${col.id}`;
            switch (col.uidt) {
              case UITypes.ForeignKey:
                {
                  if (btMap.has(col.id)) {
                    row[btMap.get(col.id)] = v;
                    delete row[k];
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

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

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
      this.debugLog(e);
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
          mmModel.source_id === source.id
            ? source
            : await Source.get(mmModel.source_id);

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
          this.debugLog(e);
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

  async exportBase(param: { path: string; sourceId: string }) {
    const hrTime = initTime();

    const source = await Source.get(param.sourceId);

    if (!source)
      throw NcError.badRequest(`Source not found for id '${param.sourceId}'`);

    const base = await Base.get(source.base_id);

    const models = (await source.getModels()).filter(
      // TODO revert this when issue with cache is fixed
      (m) => m.source_id === source.id && !m.mm && m.type === 'table',
    );

    const exportedModels = await this.serializeModels({
      modelIds: models.map((m) => m.id),
    });

    elapsedTime(
      hrTime,
      `serialize models for ${source.base_id}::${source.id}`,
      'exportBase',
    );

    const exportData = {
      id: `${base.id}::${source.id}`,
      models: exportedModels,
    };

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    const destPath = `export/${base.id}/${source.id}/${param.path}`;

    try {
      const readableStream = new Readable({
        read() {},
      });

      readableStream.setEncoding('utf8');

      readableStream.push(JSON.stringify(exportData));

      readableStream.push(null);

      await (storageAdapter as any).fileCreateByStream(
        `${destPath}/schema.json`,
        readableStream,
      );

      const handledMmList: string[] = [];

      const combinedLinkStream = new Readable({
        read() {},
      });

      const uploadLinkPromise = (storageAdapter as any).fileCreateByStream(
        `${destPath}/data/links.csv`,
        combinedLinkStream,
      );

      for (const model of models) {
        const dataStream = new Readable({
          read() {},
        });

        const linkStream = new Readable({
          read() {},
        });

        const linkPromise = new Promise((resolve) => {
          linkStream.on('data', (chunk) => {
            combinedLinkStream.push(chunk);
          });

          linkStream.on('end', () => {
            combinedLinkStream.push('\r\n');
            resolve(null);
          });

          linkStream.on('error', (e) => {
            this.debugLog(e);
            resolve(null);
          });
        });

        const uploadPromise = (storageAdapter as any).fileCreateByStream(
          `${destPath}/data/${model.id}.csv`,
          dataStream,
        );

        let error = null;

        this.streamModelDataAsCsv({
          dataStream,
          linkStream,
          baseId: base.id,
          modelId: model.id,
          handledMmList,
        }).catch((e) => {
          this.debugLog(e);
          dataStream.push(null);
          linkStream.push(null);
          error = e;
        });

        await Promise.all([uploadPromise, linkPromise]);

        if (error) throw error;
      }

      combinedLinkStream.push(null);

      await uploadLinkPromise;

      elapsedTime(
        hrTime,
        `export source ${source.base_id}::${source.id}`,
        'exportBase',
      );
    } catch (e) {
      throw NcError.badRequest(e);
    }

    return {
      path: destPath,
    };
  }
}
