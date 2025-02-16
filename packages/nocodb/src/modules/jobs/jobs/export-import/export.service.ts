import { Readable } from 'stream';
import {
  isLinksOrLTAR,
  LongTextAiMetaProp,
  RelationTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import { unparse } from 'papaparse';
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import { NcApiVersion } from 'nocodb-sdk';
import { elapsedTime, initTime } from '../../helpers';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { NcContext } from '~/interface/config';
import type { LinkToAnotherRecordColumn } from '~/models';
import {
  Base,
  BaseUser,
  Comment,
  Filter,
  Hook,
  Model,
  Source,
  View,
} from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  getViewAndModelByAliasOrId,
  serializeCellValue,
} from '~/helpers/dataHelpers';
import {
  clearPrefix,
  generateBaseIdMap,
  getEntityIdentifier,
} from '~/helpers/exportImportHelpers';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NcError } from '~/helpers/catchError';
import { DatasService } from '~/services/datas.service';
import { parseMetaProp } from '~/utils/modelUtils';

@Injectable()
export class ExportService {
  private readonly debugLog = debug('nc:jobs:import');

  constructor(private datasService: DatasService) {}

  async serializeModels(
    context: NcContext,
    param: {
      modelIds: string[];
      excludeViews?: boolean;
      excludeHooks?: boolean;
      excludeData?: boolean;
      excludeComments?: boolean;
      compatibilityMode?: boolean;
    },
  ) {
    const { modelIds } = param;

    const excludeData = param?.excludeData || false;
    const excludeViews = param?.excludeViews || false;
    const excludeHooks = param?.excludeHooks || false;
    const excludeComments =
      param?.excludeComments || param?.excludeData || false;

    const compatibilityMode = param?.compatibilityMode || false;

    const serializedModels = [];

    // db id to structured id
    const idMap = new Map<string, string>();

    const bases: Base[] = [];
    const sources: Source[] = [];
    const modelsMap = new Map<string, Model[]>();

    for (const modelId of modelIds) {
      const model = await Model.get(context, modelId);

      let pgSerialLastVal;

      if (!model) return NcError.tableNotFound(modelId);

      const fndProject = bases.find((p) => p.id === model.base_id);
      const base = fndProject || (await Base.get(context, model.base_id));

      const fndBase = sources.find((b) => b.id === model.source_id);
      const source = fndBase || (await Source.get(context, model.source_id));

      if (!fndProject) bases.push(base);
      if (!fndBase) sources.push(source);

      if (!modelsMap.has(source.id)) {
        modelsMap.set(
          source.id,
          await generateBaseIdMap(context, source, idMap),
        );
      }

      await model.getColumns(context);
      await model.getViews(context);

      // if views are excluded, filter all views except default
      if (excludeViews) {
        model.views = model.views.filter((v) => v.is_default);
      }

      for (const column of model.columns) {
        await column.getColOptions(context);

        // if data is not excluded, get currval for ai column (pg)
        if (!excludeData) {
          if (source.type === 'pg') {
            if (column.ai) {
              try {
                const baseModel = await Model.getBaseModelSQL(context, {
                  id: model.id,
                  viewId: null,
                  dbDriver: await NcConnectionMgrv2.get(source),
                });
                const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
                const seq = await sqlClient.raw(
                  `SELECT pg_get_serial_sequence('??', ?) as seq;`,
                  [baseModel.getTnPath(model.table_name), column.column_name],
                );
                if (seq.rows.length > 0 && seq.rows[0].seq) {
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
              case 'fk_qr_value_column_id':
              case 'fk_barcode_value_column_id':
              case 'fk_model_id':
                column.colOptions[k] = idMap.get(v as string);
                break;
              // Preserve the values on export
              // We will keep these only within same workspace as integration is only available within same workspace
              case 'fk_workspace_id':
              case 'fk_integrations_id':
              case 'model':
                column.colOptions[k] = v;
                break;
              case 'output_column_ids':
                column.colOptions[k] = ((v as string)?.split(',') || [])
                  .map((id) => idMap.get(id))
                  .join(',');
                break;
              case 'fk_target_view_id':
                if (v) {
                  const view = await View.get(context, v as string);
                  idMap.set(
                    view.id,
                    `${source.base_id}::${source.id}::${getEntityIdentifier(
                      view.fk_model_id,
                    )}::${view.id}`,
                  );
                  column.colOptions[k] = idMap.get(v as string);
                }
                break;
              case 'options':
                for (const o of column.colOptions['options']) {
                  delete o.id;
                  delete o.fk_column_id;
                }
                break;
              case 'formula':
                if (column.uidt === UITypes.Button) break;

                // rewrite formula_raw with aliases
                column.colOptions['formula_raw'] = column.colOptions[
                  k
                ]?.replace(/\{\{.*?\}\}/gm, (match) => {
                  const col = model.columns.find(
                    (c) => c.id === match.slice(2, -2),
                  );
                  return `{${col?.title}}`;
                });

                column.colOptions[k] = column.colOptions[k]?.replace(
                  /(?<=\{\{).*?(?=\}\})/gm,
                  (match) => idMap.get(match),
                );
                break;
              case 'fk_webhook_id':
                column.colOptions[k] = idMap.get(v as string);
                break;
              case 'fk_script_id':
                column.colOptions[k] = idMap.get(v as string);
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

        // pg default value fix
        if (source.type === 'pg') {
          if (column.cdf) {
            const cdf = column.cdf.toString();
            // check if column.cdf has unmatched single quotes
            const matches = cdf.match(/'/g);
            if (matches && matches.length % 2 !== 0) {
              // if so remove after last single quote
              const lastQuoteIndex = cdf.lastIndexOf("'");
              column.cdf = cdf.substring(0, lastQuoteIndex);
            }
          }
        }

        // Link column filters
        if (isLinksOrLTAR(column)) {
          const colOptions = column.colOptions as LinkToAnotherRecordColumn;
          colOptions.filter = (await Filter.getFilterObject(context, {
            linkColId: column.id,
          })) as any;
          if (colOptions.filter?.children?.length) {
            const export_filters = [];
            for (const fl of colOptions.filter.children) {
              const tempFl = {
                id: `${idMap.get(column.id)}::${fl.id}`,
                fk_column_id: idMap.get(fl.fk_column_id),
                fk_parent_id: `${idMap.get(column.id)}::${fl.fk_parent_id}`,
                fk_link_col_id: idMap.get(column.id),
                fk_value_col_id: fl.fk_value_col_id
                  ? idMap.get(fl.fk_value_col_id)
                  : null,
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
            colOptions.filter.children = export_filters;
          }
        }
      }

      for (const view of model.views) {
        idMap.set(view.id, `${idMap.get(model.id)}::${view.id}`);
        await view.getColumns(context);
        await view.getFilters(context);
        await view.getSorts(context);
        if (view.filter) {
          const export_filters = [];
          for (const fl of view.filter.children) {
            const tempFl = {
              id: `${idMap.get(view.id)}::${fl.id}`,
              fk_parent_column_id: fl.fk_parent_column_id
                ? idMap.get(fl.fk_parent_column_id)
                : null,
              fk_column_id: idMap.get(fl.fk_column_id),
              fk_parent_id: `${idMap.get(view.id)}::${fl.fk_parent_id}`,
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
                  const meta = parseMetaProp(view.view) as Record<string, any>;
                  for (const [k, v] of Object.entries(meta)) {
                    // keep non-array meta as it is
                    if (!Array.isArray(v)) continue;

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
              case 'calendar_range':
                if (view.type === ViewTypes.CALENDAR) {
                  const range = view.view[k];
                  view.view[k] = range.map(
                    (r: {
                      fk_to_column_id?: string;
                      fk_from_column_id: string;
                    }) => {
                      return {
                        fk_to_column_id: idMap.get(r.fk_to_column_id),
                        fk_from_column_id: idMap.get(r.fk_from_column_id),
                      };
                    },
                  );
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
        const hooks = await Hook.list(context, { fk_model_id: model.id });

        for (const hook of hooks) {
          idMap.set(hook.id, `${idMap.get(hook.fk_model_id)}::${hook.id}`);

          const hookFilters = await hook.getFilters(context);
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

      const serializedComments = [];

      if (!excludeComments) {
        const READ_BATCH_SIZE = 100;
        const comments: Comment[] = [];
        let offset = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const batchComments = await Comment.listByModel(context, model.id, {
            limit: READ_BATCH_SIZE + 1,
            offset,
          });

          comments.push(...batchComments.slice(0, READ_BATCH_SIZE));

          if (batchComments.length <= READ_BATCH_SIZE) break;
          offset += READ_BATCH_SIZE;
        }

        for (const comment of comments) {
          idMap.set(comment.id, `${idMap.get(model.id)}::${comment.id}`);

          serializedComments.push({
            id: idMap.get(comment.id),
            fk_model_id: idMap.get(comment.fk_model_id),
            row_id: comment.row_id,
            comment: comment.comment,
            parent_comment_id: comment.parent_comment_id
              ? idMap.get(comment.parent_comment_id)
              : null,
            created_by: comment.created_by,
            resolved_by: comment.resolved_by,
            created_by_email: comment.created_by_email,
            resolved_by_email: comment.resolved_by_email,
          });
        }
      }

      serializedModels.push({
        model: {
          id: idMap.get(model.id),
          prefix: base.prefix,
          title: model.title,
          table_name: clearPrefix(model.table_name, base.prefix),
          description: model.description,
          pgSerialLastVal,
          meta: model.meta,
          columns: model.columns.map((column) => ({
            description: column.description,
            id: idMap.get(column.id),
            ai: column.ai,
            column_name: column.column_name,
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
            ...(!compatibilityMode && {
              cc: column.cc,
              dt: column.dt,
              dtxp: column.dtxp,
              dtxs: column.dtxs,
              cdf: column.cdf,
            }),
          })),
        },
        views: model.views.map((view) => ({
          description: view.description,
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
          owned_by: view.owned_by,
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
        comments: serializedComments,
      });
    }

    return serializedModels;
  }

  async serializeUsers(context: NcContext, param: { baseId: string }) {
    const { baseId } = param;

    const base = await Base.get(context, baseId);

    if (!base) return NcError.baseNotFound(baseId);

    const users = await BaseUser.getUsersList(context, { base_id: base.id });

    const serializedUsers = users.map((user) => ({
      email: user.email,
      display_name: user.display_name,
      base_role: user.roles,
      workspace_role: (user as any).workspace_roles,
    }));

    return serializedUsers;
  }

  async streamModelDataAsCsv(
    context: NcContext,
    param: {
      dataStream: Readable;
      linkStream: Readable;
      baseId: string;
      modelId: string;
      viewId?: string;
      handledMmList?: string[];
      _fieldIds?: string[];
      ncSiteUrl?: string;
      delimiter?: string;
    },
  ) {
    const { dataStream, linkStream, handledMmList } = param;

    const dataExportMode = !linkStream;

    const { model, view } = await getViewAndModelByAliasOrId(context, {
      baseName: param.baseId,
      tableName: param.modelId,
      viewName: param.viewId,
    });

    const source = await Source.get(context, model.source_id);

    await model.getColumns(context);

    const btMap = new Map<string, string>();

    if (!dataExportMode) {
      for (const column of model.columns.filter(
        (col) =>
          col.uidt === UITypes.LinkToAnotherRecord &&
          (col.colOptions?.type === RelationTypes.BELONGS_TO ||
            (col.colOptions?.type === RelationTypes.ONE_TO_ONE &&
              col.meta?.bt)),
      )) {
        await column.getColOptions(context);
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
    }

    let fields = param._fieldIds
      ? model.columns
          .filter((c) => param._fieldIds?.includes(c.id))
          .map((c) => c.title)
          .join(',')
      : model.columns
          .filter((c) => !isLinksOrLTAR(c))
          .map((c) => c.title)
          .join(',');

    if (dataExportMode) {
      const viewCols = await view.getColumns(context);

      fields = viewCols
        .sort((a, b) => a.order - b.order)
        .filter((c) => c.show)
        .map((vc) => model.columns.find((c) => c.id === vc.fk_column_id).title)
        .join(',');
    }

    const mmColumns = param._fieldIds
      ? model.columns
          .filter((c) => param._fieldIds?.includes(c.id))
          .filter((col) => isLinksOrLTAR(col) && col.colOptions?.type === 'mm')
      : model.columns.filter(
          (col) => isLinksOrLTAR(col) && col.colOptions?.type === 'mm',
        );

    const hasLink = !dataExportMode && mmColumns.length > 0;

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
              case UITypes.LongText:
                if (col.meta?.[LongTextAiMetaProp] && v) {
                  try {
                    row[colId] = JSON.stringify(v);
                  } catch (e) {
                    row[colId] = v;
                  }
                } else {
                  row[colId] = v;
                }
                break;
              case UITypes.User:
              case UITypes.CreatedBy:
              case UITypes.LastModifiedBy:
                if (v) {
                  const userEmails = [];
                  const userRecord = Array.isArray(v) ? v : [v];
                  for (const user of userRecord) {
                    userEmails.push(user.email);
                  }
                  row[colId] = userEmails.join(',');
                } else {
                  row[colId] = v;
                }
                break;
              case UITypes.Formula:
              case UITypes.Lookup:
              case UITypes.Button:
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

    const formatAndSerialize = async (data: any) => {
      for (const row of data) {
        for (const [k, v] of Object.entries(row)) {
          const col = model.columns.find((c) => c.title === k);
          if (col) {
            row[k] = await serializeCellValue(context, {
              value: v,
              column: col,
              siteUrl: param.ncSiteUrl,
            });
          }
        }
      }
      return { data };
    };

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const limit = 200;
    const offset = 0;

    try {
      await this.recursiveRead(
        context,
        dataExportMode ? formatAndSerialize : formatData,
        baseModel,
        dataStream,
        model,
        view,
        offset,
        limit,
        fields,
        true,
        param.delimiter,
        dataExportMode,
      );
    } catch (e) {
      this.debugLog(e);
      throw e;
    }

    if (hasLink) {
      linkStream.setEncoding('utf8');

      let streamedHeaders = false;

      for (const mm of mmColumns) {
        if (handledMmList.includes(mm.colOptions?.fk_mm_model_id)) continue;

        const mmModel = await Model.get(context, mm.colOptions?.fk_mm_model_id);

        await mmModel.getColumns(context);

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
            : await Source.get(context, mmModel.source_id);

        const mmBaseModel = await Model.getBaseModelSQL(context, {
          id: mmModel.id,
          dbDriver: await NcConnectionMgrv2.get(mmBase),
        });

        try {
          await this.recursiveLinkRead(
            context,
            mmFormatData,
            mmBaseModel,
            linkStream,
            mmModel,
            undefined,
            mmOffset,
            mmLimit,
            mmFields,
            streamedHeaders ? false : true,
          );

          // avoid writing headers for same model multiple times
          streamedHeaders = true;
        } catch (e) {
          this.debugLog(e);
          throw e;
        }

        handledMmList.push(mm.colOptions?.fk_mm_model_id);
      }

      linkStream.push(null);
    } else {
      if (linkStream) linkStream.push(null);
    }
  }

  async recursiveRead(
    context: NcContext,
    formatter: (data: any) => { data: any } | Promise<{ data: any }>,
    baseModel: BaseModelSqlv2,
    stream: Readable,
    model: Model,
    view: View,
    offset: number,
    limit: number,
    fields: string,
    header = false,
    delimiter = ',',
    dataExportMode = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.datasService
        .getDataList(context, {
          model,
          view,
          query: { limit, offset, fields },
          baseModel,
          ignoreViewFilterAndSort: !dataExportMode,
          limitOverride: limit,
        })
        .then((result) => {
          try {
            if (!header) {
              stream.push('\r\n');
            }

            // check if formatter is async
            const formatterPromise = formatter(result.list);
            if (formatterPromise instanceof Promise) {
              formatterPromise.then(({ data }) => {
                stream.push(unparse(data, { header, delimiter }));
                if (result.pageInfo.isLastPage) {
                  stream.push(null);
                  resolve();
                } else {
                  this.recursiveRead(
                    context,
                    formatter,
                    baseModel,
                    stream,
                    model,
                    view,
                    offset + limit,
                    limit,
                    fields,
                    false,
                    delimiter,
                    dataExportMode,
                  )
                    .then(resolve)
                    .catch(reject);
                }
              });
            } else {
              stream.push(unparse(formatterPromise.data, { header }));
              if (result.pageInfo.isLastPage) {
                stream.push(null);
                resolve();
              } else {
                this.recursiveRead(
                  context,
                  formatter,
                  baseModel,
                  stream,
                  model,
                  view,
                  offset + limit,
                  limit,
                  fields,
                  false,
                  delimiter,
                  dataExportMode,
                )
                  .then(resolve)
                  .catch(reject);
              }
            }
          } catch (e) {
            reject(e);
          }
        })
        .catch(reject);
    });
  }

  async recursiveLinkRead(
    context: NcContext,
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
        .getDataList(context, {
          model,
          view,
          query: { limit, offset, fields },
          baseModel,
          ignoreViewFilterAndSort: true,
          limitOverride: limit,
          apiVersion: NcApiVersion.V1,
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
                context,
                formatter,
                baseModel,
                linkStream,
                model,
                view,
                offset + limit,
                limit,
                fields,
              )
                .then(resolve)
                .catch(reject);
            }
          } catch (e) {
            reject(e);
          }
        })
        .catch(reject);
    });
  }

  async exportBase(
    context: NcContext,
    param: { path: string; sourceId: string },
  ) {
    const hrTime = initTime();

    const source = await Source.get(context, param.sourceId);

    if (!source) NcError.sourceNotFound(param.sourceId);

    const base = await Base.get(context, source.base_id);

    const models = (await source.getModels(context)).filter(
      // TODO revert this when issue with cache is fixed
      (m) => m.source_id === source.id && !m.mm && m.type === 'table',
    );

    const exportedModels = await this.serializeModels(context, {
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

        this.streamModelDataAsCsv(context, {
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
