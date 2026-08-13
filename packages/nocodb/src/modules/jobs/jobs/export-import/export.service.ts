import { Readable } from 'stream';
import { Injectable } from '@nestjs/common';
import debug from 'debug';
import {
  getFirstNonPersonalView,
  isCrossBaseLink,
  isLinksOrLTAR,
  isMMOrMMLike,
  isSystemColumn,
  isVirtualCol,
  LongTextAiMetaProp,
  NcApiVersion,
  PermissionEntity,
  RelationTypes,
  UITypes,
  ViewTypes,
  type WidgetType,
} from 'nocodb-sdk';
import { unparse } from 'papaparse';
import * as XLSX from 'xlsx';
import { elapsedTime, initTime } from '../../helpers';
import type { LookupType, NcRequest, RollupType } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { NcContext } from '~/interface/config';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import type RowColorCondition from '~/models/RowColorCondition';
import type { GetRowColorConditionsResult } from '~/helpers/rowColorViewHelpers';
import { NcError } from '~/helpers/catchError';
import {
  escapeFormulaeInRows,
  escapeFormulaHeader,
} from '~/helpers/csvFormulaEscape';
import {
  getViewAndModelByAliasOrId,
  serializeCellValue,
} from '~/helpers/dataHelpers';
import {
  clearPrefix,
  generateBaseIdMap,
  getEntityIdentifier,
} from '~/helpers/exportImportHelpers';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { RowColorViewHelpers } from '~/helpers/rowColorViewHelpers';
import {
  Base,
  BaseUser,
  Comment,
  Dashboard,
  Filter,
  Hook,
  Model,
  Permission,
  Script,
  Source,
  View,
} from '~/models';
import CalendarRange from '~/models/CalendarRange';
import {
  buildVEvent,
  ICS_CALENDAR_FOOTER,
  ICS_NEWLINE,
  icsCalendarHeader,
} from '~/helpers/icsHelpers';
import { DatasService } from '~/services/datas.service';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { parseMetaProp } from '~/utils/modelUtils';
import { getWidgetHandler } from '~/db/widgets';
import { getQueriedColumns } from '~/helpers/dbHelpers';

@Injectable()
export class ExportService {
  protected readonly debugLog = debug('nc:jobs:import');

  constructor(protected datasService: DatasService) {}

  async getDataList(context: NcContext, param: any) {
    return this.datasService.dataList(context, param);
  }

  async serializeScripts(context: NcContext) {
    const serializedScripts = [];

    const scripts = await Script.list(context, context.base_id);

    for (const script of scripts) {
      serializedScripts.push({
        title: script.title,
        script: script.script,
        description: script.description,
        meta: script.meta,
      });
    }

    return serializedScripts;
  }

  async serializeDocuments(_context: NcContext) {
    return [];
  }

  async serializeWorkflows(_context: NcContext, _param: any, _req: NcRequest) {
    return [];
  }

  async serializeInterfaces(
    _context: NcContext,
    _param: { idMap: Map<string, string>; req: NcRequest },
  ) {
    return [];
  }

  async serializeDashboards(context: NcContext, param: any, req: NcRequest) {
    const { idMap } = param;
    const serializedDashboards = [];

    const dashboards = await Dashboard.list(context, context.base_id);

    for (const dashboard of dashboards) {
      idMap.set(dashboard.id, `${dashboard.base_id}::${dashboard.id}`);

      await dashboard.getWidgets(context);

      const serializedWidgets = [];

      for (const widget of dashboard.widgets) {
        const handler = await getWidgetHandler(context, {
          widget: widget as WidgetType,
          req,
        });

        const serializedWidget = await handler.serializeOrDeserializeWidget(
          context,
          widget as any,
          idMap,
        );

        const filters = await Filter.getFilterObject(context, {
          widgetId: widget.id,
        });

        const exportedFilters = [];

        if (filters?.children?.length) {
          for (const fl of filters.children) {
            const tempFl = {
              id: `${idMap.get(widget.id)}::${fl.id}`,
              fk_column_id: idMap.get(fl.fk_column_id),
              fk_parent_id: `${idMap.get(widget.id)}::${fl.fk_parent_id}`,
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
            exportedFilters.push(tempFl);
          }
        }

        serializedWidgets.push({
          ...serializedWidget,
          filters: exportedFilters,
        });
      }

      serializedDashboards.push({
        id: idMap.get(dashboard.id),
        title: dashboard.title,
        description: dashboard.description,
        order: dashboard.order,
        meta: dashboard.meta,
        widgets: serializedWidgets,
      });
    }

    return serializedDashboards;
  }

  async serializeModels(
    context: NcContext,
    param: {
      modelIds: string[];
      excludeViews?: boolean;
      excludeHooks?: boolean;
      excludeRowColorConditions?: boolean;
      excludeData?: boolean;
      excludeComments?: boolean;
      excludePermissions?: boolean;
      compatibilityMode?: boolean;
    },
  ) {
    const { modelIds } = param;

    const excludeData = param?.excludeData || false;
    const excludeViews = param?.excludeViews || false;
    const excludeHooks = param?.excludeHooks || false;
    const excludeRowColorConditions = param?.excludeRowColorConditions || false;
    const excludeComments =
      param?.excludeComments || param?.excludeData || false;
    const excludePermissions = param?.excludePermissions || false;

    const compatibilityMode = param?.compatibilityMode || false;

    const serializedModels = [];

    // db id to structured id
    const idMap = new Map<string, string>();

    const bases: Base[] = [];
    const sources: Source[] = [];
    const modelsMap = new Map<string, Model[]>();

    for (const modelId of modelIds) {
      const model = await Model.get(context, modelId);

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

      model.columns = this.filterOutCrossBaseColumns(model);

      await model.getViews(context);

      // if views are excluded, filter all views except default
      const firstView = getFirstNonPersonalView(model.views, {
        includeViewType: ViewTypes.GRID,
      });

      if (excludeViews) {
        if (firstView) {
          (firstView as any).is_default = true;
        }

        model.views = firstView ? [firstView as View] : [];
      } else {
        model.views = model.views.map((view) => {
          if (view.id === firstView.id) {
            (view as any).is_default = true;
          }
          return view;
        });
      }

      for (const column of model.columns) {
        await column.getColOptions(context);

        if (column.colOptions) {
          for (const [k, v] of Object.entries(column.colOptions)) {
            switch (k) {
              // per-link order columns on the junction — remap like the other
              // junction refs so duplicate/snapshot don't dangle at source ids
              case 'fk_mm_child_order_column_id':
              case 'fk_mm_parent_order_column_id':
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
              case 'fk_display_value_column_id':
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

          // if cross base link skip
          if (
            colOptions?.fk_related_base_id &&
            colOptions.fk_related_base_id !== colOptions.base_id
          ) {
            continue;
          }
          // skip custom link columns
          if (column?.meta?.custom) {
            continue;
          }

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
              meta: fl.meta,
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
              enabled: sr.enabled,
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
              case 'fk_prefix_column_id':
                view.view[k] = idMap.get(v as string);
                break;
              case 'levels':
                if (view.type === ViewTypes.LIST) {
                  view.view[k] = (v as any[]).map((level) => ({
                    level: level.level,
                    fk_model_id:
                      idMap.get(level.fk_model_id) ?? level.fk_model_id,
                    fk_link_column_id: level.fk_link_column_id
                      ? idMap.get(level.fk_link_column_id) ??
                        level.fk_link_column_id
                      : null,
                    fk_self_link_column_id: level.fk_self_link_column_id
                      ? idMap.get(level.fk_self_link_column_id) ??
                        level.fk_self_link_column_id
                      : null,
                    enable_nested_records: level.enable_nested_records,
                    wrap_headers: level.wrap_headers,
                    meta: level.meta,
                  }));
                }
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
              case 'timeline_range':
                // Timeline range arrays are loaded onto view.view by
                // TimelineView.get. Remap column refs to external ids so the
                // importer's idMap lookup resolves to the target table's
                // columns (mirrors calendar_range above).
                if (view.type === ViewTypes.TIMELINE) {
                  const range = view.view[k] as any[];
                  view.view[k] = (range ?? []).map(
                    (r: {
                      fk_from_column_id?: string;
                      fk_to_column_id?: string;
                    }) => ({
                      fk_from_column_id: idMap.get(r.fk_from_column_id),
                      fk_to_column_id: r.fk_to_column_id
                        ? idMap.get(r.fk_to_column_id)
                        : null,
                    }),
                  );
                }
                break;
              case 'date_dependency':
                // Per-view DateDependency rule eager-loaded onto view.view by
                // GanttView.get. Remap every field id ref so the importer
                // can reconstruct the rule against the new table's columns.
                if (view.type === ViewTypes.GANTT) {
                  const dep = view.view[k] as any;
                  if (dep) {
                    view.view[k] = {
                      is_active: dep.is_active,
                      fk_start_date_field_id: dep.fk_start_date_field_id
                        ? idMap.get(dep.fk_start_date_field_id)
                        : null,
                      fk_end_date_field_id: dep.fk_end_date_field_id
                        ? idMap.get(dep.fk_end_date_field_id)
                        : null,
                      fk_duration_field_id: dep.fk_duration_field_id
                        ? idMap.get(dep.fk_duration_field_id)
                        : null,
                      fk_dependency_linkrow_field_id:
                        dep.fk_dependency_linkrow_field_id
                          ? idMap.get(dep.fk_dependency_linkrow_field_id)
                          : null,
                      dependency_linkrow_role: dep.dependency_linkrow_role,
                      dependency_connection_type:
                        dep.dependency_connection_type,
                      dependency_buffer_type: dep.dependency_buffer_type,
                      dependency_buffer_days: dep.dependency_buffer_days,
                      include_weekends: dep.include_weekends,
                    };
                  }
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

      let serializedRowColorConditions: {
        result: GetRowColorConditionsResult;
        filters: Filter[];
        rowColorConditions: RowColorCondition[];
      } = {
        result: [],
        filters: [],
        rowColorConditions: [],
      };
      if (!excludeRowColorConditions) {
        serializedRowColorConditions = await RowColorViewHelpers.withContext(
          context,
        ).getDuplicateRowColorConditions({
          views: model.views,
          idMap,
          mapColumnId: true,
        });
      }

      const serializedHooks = [];

      if (!excludeHooks) {
        const hooks = await Hook.list(context, { fk_model_id: model.id });

        for (const hook of hooks) {
          idMap.set(hook.id, `${idMap.get(hook.fk_model_id)}::${hook.id}`);

          const hookFilters = await Filter.getFilterObject(context, {
            hookId: hook.id,
          });
          const export_filters = [];

          if (hookFilters?.children?.length) {
            for (const fl of hookFilters.children) {
              const tempFl = {
                id: `${idMap.get(hook.id)}::${fl.id}`,
                fk_column_id: idMap.get(fl.fk_column_id),
                fk_parent_id: `${idMap.get(hook.id)}::${fl.fk_parent_id}`,
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

      const serializedPermissions = [];

      if (!excludePermissions) {
        const basePermissions = await Permission.list(context, model.base_id);

        const fieldIds = model.columns.map((c) => c.id);

        const modelPermissions = basePermissions.filter(
          (p) =>
            (p.entity === PermissionEntity.TABLE && p.entity_id === model.id) ||
            (p.entity === PermissionEntity.FIELD &&
              fieldIds.includes(p.entity_id)),
        );

        for (const permission of modelPermissions) {
          idMap.set(
            permission.id,
            `${idMap.get(permission.entity_id)}::${permission.id}`,
          );

          serializedPermissions.push({
            id: idMap.get(permission.id),
            entity: permission.entity,
            entity_id: idMap.get(permission.entity_id),
            permission: permission.permission,
            enforce_for_form: permission.enforce_for_form,
            enforce_for_automation: permission.enforce_for_automation,
            granted_type: permission.granted_type,
            granted_role: permission.granted_role,
            subjects: permission.subjects,
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
          meta: model.meta,
          columns: model.columns.map((column) => {
            // Exclude constraints field from export (internal field)
            const { constraints, ...columnData } = column as any;
            return {
              description: columnData.description,
              id: idMap.get(columnData.id),
              ai: columnData.ai,
              column_name: columnData.column_name,
              meta: columnData.meta,
              pk: columnData.pk,
              pv: columnData.pv,
              order: columnData.order,
              rqd: columnData.rqd,
              system: columnData.system,
              uidt: columnData.uidt,
              title: columnData.title,
              un: columnData.un,
              unique: columnData.unique,
              colOptions: columnData.colOptions,
              ...(!compatibilityMode && {
                cc: columnData.cc,
                dt: columnData.dt,
                dtxp: columnData.dtxp,
                dtxs: columnData.dtxs,
                cdf: columnData.cdf,
              }),
            };
          }),
        },
        views: model.views.map((view) => ({
          description: view.description,
          id: idMap.get(view.id),
          type: view.type,
          meta: RowColorViewHelpers.withContext(context).mapMetaColumn({
            meta: view.meta,
            idMap,
          }),
          is_default: (view as any).is_default,
          order: view.order,
          title: view.title,
          show: view.show,
          show_system_fields: view.show_system_fields,
          filter: view.filter,
          sorts: view.sorts,
          lock_type: view.lock_type,
          owned_by: view.owned_by,
          row_coloring_mode: view.row_coloring_mode,
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
        rowColorConditions: {
          filters: serializedRowColorConditions.filters,
          rowColorConditions: serializedRowColorConditions.rowColorConditions,
        },
        hooks: serializedHooks,
        comments: serializedComments,
        permissions: serializedPermissions,
        idMap,
      });
    }
    return {
      serializedModels,
      idMap,
    };
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
      /**
       * Column projection for the export, in the caller's own order. This is
       * a SERVER-COMPOSED list — it must never be forwarded straight from a
       * request payload, since it bypasses the ref view's column visibility.
       * Current callers both derive it internally:
       *  - `DuplicateProcessor` — columns of the model being duplicated.
       *  - `InterfaceDataExportProcessor` — `scope.exportColumnIds`, resolved
       *    by `InterfaceDatasService.tableDataExport` from the stored viz
       *    config (`viz.visible_field_ids`) after grant/env resolution; the
       *    client only supplies `pageId`/`vizId`/`env`.
       * Ids are additionally intersected with `model.columns` below, so an
       * id from another model resolves to nothing rather than leaking.
       */
      _fieldIds?: string[];
      ncSiteUrl?: string;
      delimiter?: string;
      excludeUsers?: boolean;
      includeCrossBaseColumns?: boolean;
      /**
       * Junctions to stream even though the link is cross-base. Empty by
       * default — such rows reference a table outside the export. Consolidation
       * passes the junctions whose endpoints both landed in its target.
       */
      crossBaseLinkMmModelIds?: string[];
      filterArrJson?: any;
      sortArrJson?: any;
      locale?: string;
      customConditions?: Filter[];
    },
  ) {
    context = { ...context, cache: true };

    const { dataStream, linkStream, handledMmList } = param;

    const dataExportMode = !linkStream;

    const { model, view } = await getViewAndModelByAliasOrId(context, {
      baseName: param.baseId,
      tableName: param.modelId,
      viewName: param.viewId,
    });

    const source = await Source.get(context, model.source_id);

    await model.getColumns(context);

    if (!param.includeCrossBaseColumns) {
      model.columns = this.filterOutCrossBaseColumns(model);
    } else {
      model.columns = [...model.columns];
    }

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
      : model.columns
          .filter((c) => !isLinksOrLTAR(c) && !isVirtualCol(c))
          .map((c) => c.title);

    const refView =
      view ?? (await View.getFirstCollaborativeView(context, model.id));

    if (!refView) {
      this.debugLog(
        `no collaborative view found for model ${model.id} — skipping data export`,
      );
      dataStream.push(null);
      linkStream?.push(null);
      return;
    }

    const viewCols = await refView.getColumns(context);
    if (dataExportMode) {
      if (param._fieldIds?.length) {
        // Caller-curated export columns (interface-page exports) — keep the
        // caller's order instead of the ref view's column visibility/order.
        fields = param._fieldIds
          .map((id) => model.columns.find((c) => c.id === id)?.title)
          .filter(Boolean);
      } else {
        const hideSystemFields = refView.show_system_fields
          ? // at minimum filter mm fields used in Links field
            model.columns
              .filter(
                (c) =>
                  isSystemColumn(c) &&
                  c.uidt === UITypes.LinkToAnotherRecord &&
                  c.colOptions?.fk_related_model_id !== model.id,
              )
              .map((c) => c.id)
          : model.columns.filter((c) => isSystemColumn(c)).map((c) => c.id);

        fields = viewCols
          .sort((a, b) => a.order - b.order)
          .filter((c) => c.show && !hideSystemFields.includes(c.fk_column_id))
          .map(
            (vc) => model.columns.find((c) => c.id === vc.fk_column_id)?.title,
          )
          // to filter out undefined values(cross base link)
          .filter(Boolean);
      }
    }

    const crossBaseMmAllowList = new Set(param.crossBaseLinkMmModelIds ?? []);
    const isExportableMm = (col: Column) =>
      isMMOrMMLike(col) &&
      (!isCrossBaseLink(col) ||
        crossBaseMmAllowList.has(col.colOptions?.fk_mm_model_id));

    const mmColumns = param._fieldIds
      ? model.columns
          .filter((c) => param._fieldIds?.includes(c.id))
          .filter(isExportableMm)
      : model.columns.filter(isExportableMm);

    const hasLink = !dataExportMode && mmColumns.length > 0;

    dataStream.setEncoding('utf8');

    const formatData = (data: any) => {
      for (const row of data) {
        for (const [k, v] of Object.entries(row)) {
          const col = model.columns.find((c) => c.title === k);
          if (col) {
            const colId = `${col.base_id}::${col.source_id}::${col.fk_model_id}::${col.id}`;
            let skip = false;
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
                  if (typeof v === 'string') {
                    try {
                      JSON.parse(v);
                      // use v if valid JSON
                      row[colId] = v;
                    } catch (ex) {
                      row[colId] = null;
                    }
                  } else {
                    row[colId] = JSON.stringify(v);
                  }
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
                // skip populating if excludeUsers is true
                if (param.excludeUsers === true) {
                  row[colId] = null;
                  break;
                }

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
                skip = true;
                break;
              case UITypes.JSON:
                try {
                  row[colId] = JSON.stringify(v);
                } catch (e) {
                  // avoid exporting invalid JSON
                  row[colId] = null;
                }
                break;
              default:
                row[colId] = v;
                break;
            }
            delete row[k];

            if (!skip) {
              // if the value is explicitly empty string preserve it
              if (v === '') {
                row[colId] = '__nc_empty_string__';
              }
            }
          }
        }
      }
      return { data };
    };

    const fieldIdOrder = param._fieldIds?.length
      ? new Map(param._fieldIds.map((id, index) => [id, index]))
      : null;

    const formatAndSerialize = async (data: any) => {
      const includedColumns: {
        col: Column;
        viewOrder: number;
      }[] = [];
      for (const row of data) {
        for (const [k, v] of Object.entries(row)) {
          const col = model.columns.find((c) => c.title === k);
          if (col) {
            row[k] = await serializeCellValue(context, {
              value: v,
              column: col,
              siteUrl: param.ncSiteUrl,
              locale: param.locale,
            });
            includedColumns.push({
              col,
              viewOrder: fieldIdOrder
                ? fieldIdOrder.get(col.id) ?? includedColumns.length + 1
                : viewCols.find((vCol) => vCol.fk_column_id === col.id)
                    ?.order ?? includedColumns.length + 1,
            });
          }
        }
      }
      const orderedColumns = includedColumns.sort(
        (a, b) => a.viewOrder - b.viewOrder,
      );
      return {
        data: data.map((row) => {
          return orderedColumns.reduce((acc, cur) => {
            acc[cur.col.title] = row[cur.col.title];
            return acc;
          }, {});
        }),
      };
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
        {
          filterArrJson: param.filterArrJson,
          sortArrJson: param.sortArrJson,
          customConditions: param.customConditions,
        },
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

        // A cross-base junction lives in whichever base owns it, not
        // necessarily the one holding the link column being read.
        const mmColOptions = mm.colOptions as LinkToAnotherRecordColumn;
        const mmContext =
          mmColOptions.fk_mm_base_id &&
          mmColOptions.fk_mm_base_id !== context.base_id
            ? mmColOptions.getRelContext(context).mmContext
            : context;

        const mmModel = await Model.get(
          mmContext,
          mm.colOptions?.fk_mm_model_id,
        );

        await mmModel.getColumns(mmContext);

        mmModel.columns = this.filterOutCrossBaseColumns(mmModel);

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
          .map((c) => c.title);

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
            : await Source.get(mmContext, mmModel.source_id);

        const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
          id: mmModel.id,
          dbDriver: await NcConnectionMgrv2.get(mmBase),
        });

        try {
          const wrote = await this.recursiveLinkRead(
            mmContext,
            mmFormatData,
            mmBaseModel,
            linkStream,
            mmModel,
            undefined,
            mmOffset,
            mmLimit,
            mmFields,
            !streamedHeaders,
          );

          // avoid writing headers for same model multiple times
          if (wrote) streamedHeaders = true;
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

  async streamModelDataAsJson(
    context: NcContext,
    param: {
      dataStream: Readable;
      baseId: string;
      modelId: string;
      viewId?: string;
      handledMmList?: string[];
      _fieldIds?: string[];
      ncSiteUrl?: string;
      excludeUsers?: boolean;
      includeCrossBaseColumns?: boolean;
      filterArrJson?: any;
      sortArrJson?: any;
      locale?: string;
    },
  ) {
    context = { ...context, cache: true };

    const { dataStream } = param;

    const { model, view } = await getViewAndModelByAliasOrId(context, {
      baseName: param.baseId,
      tableName: param.modelId,
      viewName: param.viewId,
    });

    const source = await Source.get(context, model.source_id);

    await model.getColumns(context);

    if (!param.includeCrossBaseColumns) {
      model.columns = this.filterOutCrossBaseColumns(model);
    } else {
      model.columns = [...model.columns];
    }

    let fields = param._fieldIds
      ? model.columns
          .filter((c) => param._fieldIds?.includes(c.id))
          .map((c) => c.title)
      : model.columns
          .filter((c) => !isLinksOrLTAR(c) && !isVirtualCol(c))
          .map((c) => c.title);

    const refView =
      view ?? (await View.getFirstCollaborativeView(context, model.id));

    const viewCols = await refView.getColumns(context);

    const hideSystemFields = view.show_system_fields
      ? // at minimum filter mm fields used in Links field
        model.columns
          .filter(
            (c) =>
              isSystemColumn(c) &&
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions?.fk_related_model_id !== model.id,
          )
          .map((c) => c.id)
      : model.columns.filter((c) => isSystemColumn(c)).map((c) => c.id);

    fields = viewCols
      .sort((a, b) => a.order - b.order)
      .filter((c) => c.show && !hideSystemFields.includes(c.fk_column_id))
      .map((vc) => model.columns.find((c) => c.id === vc.fk_column_id)?.title)
      // to filter out undefined values(cross base link)
      .filter(Boolean);

    dataStream.setEncoding('utf8');

    const formatAndSerializeForJson = async (data: any) => {
      const includedColumns: {
        col: Column;
        viewOrder: number;
      }[] = [];
      for (const row of data) {
        for (const [k, v] of Object.entries(row)) {
          const col = model.columns.find((c) => c.title === k);
          if (col) {
            row[k] = await serializeCellValue(context, {
              value: v,
              column: col,
              siteUrl: param.ncSiteUrl,
              locale: param.locale,
            });
            includedColumns.push({
              col,
              viewOrder:
                viewCols.find((vCol) => vCol.fk_column_id === col.id)?.order ??
                includedColumns.length + 1,
            });
          }
        }
      }
      const orderedColumns = includedColumns.sort(
        (a, b) => a.viewOrder - b.viewOrder,
      );
      return {
        data: data.map((row) => {
          return orderedColumns.reduce((acc, cur) => {
            acc[cur.col.title] = row[cur.col.title];
            return acc;
          }, {});
        }),
      };
    };

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const limit = 200;
    const offset = 0;

    try {
      await this.recursiveReadForJson(
        context,
        formatAndSerializeForJson,
        baseModel,
        dataStream,
        model,
        view,
        offset,
        limit,
        fields,
        true,
        {
          filterArrJson: param.filterArrJson,
          sortArrJson: param.sortArrJson,
        },
      );
    } catch (e) {
      this.debugLog(e);
      throw e;
    }
  }

  async streamModelDataAsIcs(
    context: NcContext,
    param: {
      dataStream: Readable;
      baseId: string;
      modelId: string;
      viewId?: string;
      ncSiteUrl?: string;
      filterArrJson?: any;
      sortArrJson?: any;
      locale?: string;
      restrictToViewVisibleColumns?: boolean;
    },
  ) {
    context = { ...context, cache: true };

    const { dataStream } = param;

    const { model, view } = await getViewAndModelByAliasOrId(context, {
      baseName: param.baseId,
      tableName: param.modelId,
      viewName: param.viewId,
    });

    if (!view || view.type !== ViewTypes.CALENDAR) {
      NcError.get(context).badRequest(
        'ICS export is only supported for calendar views',
      );
    }

    const calendarRange = await CalendarRange.read(context, view.id);

    const range = calendarRange?.ranges?.[0];

    if (!range?.fk_from_column_id) {
      NcError.get(context).badRequest(
        'Calendar view has no date field configured for export',
      );
    }

    const source = await Source.get(context, model.source_id);

    await model.getColumns(context);

    model.columns = this.filterOutCrossBaseColumns(model);

    const fromColumn = model.columns.find(
      (c) => c.id === range.fk_from_column_id,
    );
    // fk_to_column_id is an EE-only field on the calendar range
    const toColumnId = (range as { fk_to_column_id?: string }).fk_to_column_id;
    const toColumn = toColumnId
      ? model.columns.find((c) => c.id === toColumnId)
      : undefined;

    if (!fromColumn) {
      NcError.get(context).badRequest(
        'Calendar view date field is no longer available',
      );
    }

    const dateOnlyTypes: string[] = [UITypes.Date];
    const fromIsDateOnly = dateOnlyTypes.includes(fromColumn.uidt);

    const displayColumn =
      model.columns.find((c) => c.pv) ?? model.columns.find((c) => c.pk);

    const pkColumn = model.columns.find((c) => c.pk);

    // Anonymous (public) export path only: narrow the description to the columns
    // the shared view actually shows, so a view-hidden column's values can't be
    // read out of the ICS feed. Stays null for authenticated exports.
    let visibleColumnIds: Set<string> | null = null;
    if (param.restrictToViewVisibleColumns) {
      const viewColumns = await View.getColumns(context, view.id);
      visibleColumnIds = new Set(
        viewColumns.filter((vc) => vc.show).map((vc) => vc.fk_column_id),
      );
    }

    // Non-system, non-virtual data columns (in field order) used to build the
    // event description so the exported event keeps the row's context. The
    // range fields and the display value are excluded — they map to dedicated
    // ICS properties. Calendar views usually hide every non-date field, so for
    // authenticated exports the description is built from the model columns
    // (fetched via getHiddenColumns) rather than the view's visible ones; the
    // public path above narrows it back down.
    const descriptionColumns = model.columns.filter(
      (c) =>
        !isSystemColumn(c) &&
        !isLinksOrLTAR(c) &&
        !isVirtualCol(c) &&
        c.id !== fromColumn.id &&
        (!toColumn || c.id !== toColumn.id) &&
        (!displayColumn || c.id !== displayColumn.id) &&
        (!visibleColumnIds || visibleColumnIds.has(c.id)),
    );

    dataStream.setEncoding('utf8');

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const dtstamp = new Date().toISOString();

    const serializeForDescription = async (value: any, column: Column) => {
      return serializeCellValue(context, {
        value,
        column,
        siteUrl: param.ncSiteUrl,
        locale: param.locale,
      });
    };

    dataStream.push(icsCalendarHeader(`${model.title} (${view.title})`));

    const limit = 200;
    let offset = 0;

    try {
      for (;;) {
        const result = await this.datasService.dataList(context, {
          model,
          view,
          query: {
            limit,
            offset,
            filterArrJson: param.filterArrJson,
            sortArrJson: param.sortArrJson,
          },
          baseModel,
          // Calendar views hide all non-date fields; include them so the event
          // title and details are exported, while still honouring view filters.
          getHiddenColumns: true,
          ignoreViewFilterAndSort: false,
          limitOverride: limit,
          skipSortBasedOnOrderCol: true,
        });

        for (let i = 0; i < result.list.length; i++) {
          const row = result.list[i];
          const startValue = row[fromColumn.title];

          // Skip records without a start date — they can't be a calendar event.
          if (
            startValue === null ||
            startValue === undefined ||
            startValue === ''
          ) {
            continue;
          }

          const summary = displayColumn
            ? await serializeForDescription(
                row[displayColumn.title],
                displayColumn,
              )
            : undefined;

          const descriptionParts: string[] = [];
          for (const col of descriptionColumns) {
            const serialized = await serializeForDescription(
              row[col.title],
              col,
            );
            if (
              serialized !== null &&
              serialized !== undefined &&
              serialized !== ''
            ) {
              descriptionParts.push(`${col.title}: ${serialized}`);
            }
          }

          // RFC 5545 requires UID to be globally unique. Use the primary key
          // when present (guarding against an empty value, which `&&`/`??`
          // would otherwise let through), else fall back to the page offset +
          // row index.
          const pkValue = pkColumn ? row[pkColumn.title] : undefined;
          const hasRealPk =
            pkValue !== null && pkValue !== undefined && pkValue !== '';
          const recordId = hasRealPk ? pkValue : `${offset}-${i}`;

          // Deep link back to the record, mirroring the dashboard's
          // copy-record-URL route: {site}/{workspace}/{base}/{table}/{view}?rowId.
          // Only emitted when we have a site URL and a real primary key (the
          // fallback id wouldn't resolve to a record).
          const recordUrl =
            param.ncSiteUrl && hasRealPk
              ? `${param.ncSiteUrl}/${context.workspace_id}/${model.base_id}/${
                  model.id
                }/${view.id}?rowId=${encodeURIComponent(String(pkValue))}`
              : undefined;

          const vEvent = buildVEvent({
            uid: `${recordId}@${view.id}.nocodb`,
            dtstamp,
            summary,
            description: descriptionParts.join('\n') || undefined,
            start: startValue,
            end: toColumn ? row[toColumn.title] : undefined,
            startIsDateOnly: fromIsDateOnly,
            url: recordUrl,
          });

          if (vEvent) {
            dataStream.push(vEvent + ICS_NEWLINE);
          }
        }

        if (result.pageInfo.isLastPage || result.list.length === 0) {
          break;
        }

        offset += limit;
      }

      dataStream.push(ICS_CALENDAR_FOOTER);
      dataStream.push(null);
    } catch (e) {
      this.debugLog(e);
      dataStream.push(null);
      throw e;
    }
  }

  async streamModelDataAsExcel(
    context: NcContext,
    param: {
      dataStream: Readable;
      baseId: string;
      modelId: string;
      viewId?: string;
      ncSiteUrl?: string;
      includeCrossBaseColumns?: boolean;
      filterArrJson?: any;
      sortArrJson?: any;
      locale?: string;
    },
  ) {
    context = { ...context, cache: true };

    const { dataStream } = param;

    const { model, view } = await getViewAndModelByAliasOrId(context, {
      baseName: param.baseId,
      tableName: param.modelId,
      viewName: param.viewId,
    });

    const source = await Source.get(context, model.source_id);

    await model.getColumns(context);

    if (!param.includeCrossBaseColumns) {
      model.columns = this.filterOutCrossBaseColumns(model);
    } else {
      model.columns = [...model.columns];
    }

    const refView =
      view ?? (await View.getFirstCollaborativeView(context, model.id));

    const viewCols = await refView.getColumns(context);

    const hideSystemFields = view.show_system_fields
      ? model.columns
          .filter(
            (c) =>
              isSystemColumn(c) &&
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions?.fk_related_model_id !== model.id,
          )
          .map((c) => c.id)
      : model.columns.filter((c) => isSystemColumn(c)).map((c) => c.id);

    const fields = viewCols
      .sort((a, b) => a.order - b.order)
      .filter((c) => c.show && !hideSystemFields.includes(c.fk_column_id))
      .map((vc) => model.columns.find((c) => c.id === vc.fk_column_id)?.title)
      .filter(Boolean);

    const formatAndSerialize = async (data: any) => {
      const includedColumns: {
        col: Column;
        viewOrder: number;
      }[] = [];
      for (const row of data) {
        for (const [k, v] of Object.entries(row)) {
          const col = model.columns.find((c) => c.title === k);
          if (col) {
            row[k] = await serializeCellValue(context, {
              value: v,
              column: col,
              siteUrl: param.ncSiteUrl,
              locale: param.locale,
            });
            includedColumns.push({
              col,
              viewOrder:
                viewCols.find((vCol) => vCol.fk_column_id === col.id)?.order ??
                includedColumns.length + 1,
            });
          }
        }
      }
      const orderedColumns = includedColumns.sort(
        (a, b) => a.viewOrder - b.viewOrder,
      );
      return {
        data: data.map((row) => {
          return orderedColumns.reduce((acc, cur) => {
            acc[cur.col.title] = row[cur.col.title];
            return acc;
          }, {});
        }),
      };
    };

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const limit = 200;
    const offset = 0;

    try {
      await this.recursiveReadForExcel(
        context,
        formatAndSerialize,
        baseModel,
        dataStream,
        model,
        view,
        offset,
        limit,
        fields,
        {
          filterArrJson: param.filterArrJson,
          sortArrJson: param.sortArrJson,
        },
      );
    } catch (e) {
      this.debugLog(e);
      throw e;
    }
  }

  async recursiveReadForExcel(
    context: NcContext,
    formatter: (data: any) => Promise<{ data: any }>,
    baseModel: BaseModelSqlv2,
    stream: Readable,
    model: Model,
    view: View,
    offset: number,
    limit: number,
    fields: string[],
    param?: {
      filterArrJson: any;
      sortArrJson: any;
    },
    allRows: Record<string, any>[] = [],
    headers: string[] = [],
  ): Promise<void> {
    const result = await this.datasService.dataList(context, {
      model,
      view,
      query: {
        limit,
        offset,
        fields,
        nested: this.buildNestedLinkLimitQuery(model),
        filterArrJson: param?.filterArrJson,
        sortArrJson: param?.sortArrJson,
      },
      baseModel,
      ignoreViewFilterAndSort: false,
      limitOverride: limit,
      skipSortBasedOnOrderCol: true,
    });

    if (result.list.length === 0 && offset === 0) {
      // Empty result - generate Excel with just headers
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([escapeFormulaHeader(fields)]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      const excelBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });
      stream.push(excelBuffer);
      stream.push(null);
      return;
    }

    const { data } = await formatter(result.list);

    // Capture headers from the first batch (preserves view column order)
    if (offset === 0 && data.length > 0) {
      headers.push(...Object.keys(data[0]));
    }

    allRows.push(...data);

    if (result.pageInfo.isLastPage) {
      // All data collected — generate Excel workbook
      // xlsx opens in the same spreadsheet apps as CSV, so it carries the same
      // CWE-1236 exposure — escape it the way the CSV path does.
      escapeFormulaeInRows(allRows, model.columns);

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(allRows, {
        header: headers,
      });
      // `header` doubles as the row-key lookup, so it must stay unescaped above;
      // rewrite the emitted header row afterwards.
      XLSX.utils.sheet_add_aoa(worksheet, [escapeFormulaHeader(headers)], {
        origin: 'A1',
      });
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

      const excelBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });

      stream.push(excelBuffer);
      stream.push(null);
    } else {
      await this.recursiveReadForExcel(
        context,
        formatter,
        baseModel,
        stream,
        model,
        view,
        offset + limit,
        limit,
        fields,
        param,
        allRows,
        headers,
      );
    }
  }

  async recursiveReadForJson(
    context: NcContext,
    formatter: (data: any) => Promise<{ data: any }>,
    baseModel: BaseModelSqlv2,
    stream: Readable,
    model: Model,
    view: View,
    offset: number,
    limit: number,
    fields: string[],
    isFirst = false,
    param?: {
      filterArrJson: any;
      sortArrJson: any;
    },
  ): Promise<void> {
    const result = await this.datasService.dataList(context, {
      model,
      view,
      query: {
        limit,
        offset,
        fields,
        nested: this.buildNestedLinkLimitQuery(model),
        filterArrJson: param?.filterArrJson,
        sortArrJson: param?.sortArrJson,
      },
      baseModel,
      ignoreViewFilterAndSort: false,
      limitOverride: limit,
      skipSortBasedOnOrderCol: true,
    });

    if (result.list.length === 0 && offset === 0) {
      // Empty result, just return empty array
      stream.push('[]');
      stream.push(null);
      return;
    }

    const { data } = await formatter(result.list);

    if (isFirst) {
      // Start JSON array
      stream.push('[\n');
    }

    if (data.length > 0) {
      // Add comma if not the first batch
      if (offset > 0) {
        stream.push(',\n');
      }

      // Write JSON objects
      const jsonRows = data.map((row) => JSON.stringify(row)).join(',\n');
      stream.push(jsonRows);
    }

    if (result.pageInfo.isLastPage) {
      // Close JSON array
      stream.push('\n]');
      stream.push(null);
    } else {
      await this.recursiveReadForJson(
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
        param,
      );
    }
  }

  private filterOutCrossBaseColumns(model: Model) {
    const crossbaseLinkIds = new Set(
      model.columns.filter((c) => isCrossBaseLink(c)).map((c) => c.id),
    );
    // filter out cross base link columns and any Lookup or Rollup columns which is dependent on cross base link
    return model.columns.filter((c) =>
      !isCrossBaseLink(c) &&
      ([UITypes.Lookup, UITypes.Rollup] as string[]).includes(c.uidt)
        ? !crossbaseLinkIds.has(
            (c.colOptions as LookupType | RollupType).fk_relation_column_id,
          )
        : true,
    );
  }

  // Serialize export rows to CSV. For user-facing exports that emit the header row, the
  // column titles are escaped too (CWE-1236) — the title is as user-controlled as the
  // cells. PapaParse derives the header from the object keys, so escaping the keys would
  // break value lookup; instead we pass the explicit { fields, data } form, decoupling the
  // (escaped) header from positional values. Cell values are already escaped upstream via
  // escapeFormulaeInRows. When not escaping the header, behaviour is byte-for-byte the
  // original unparse(rows, { header, delimiter }).
  private unparseExportRows(
    rows: any[],
    opts: { header: boolean; delimiter?: string; escapeHeader: boolean },
  ): string {
    if (opts.escapeHeader && opts.header) {
      return unparse(
        {
          fields: escapeFormulaHeader(Object.keys(rows[0] ?? {})),
          data: rows.map((row) => Object.values(row)),
        },
        { delimiter: opts.delimiter },
      );
    }
    return unparse(rows, { header: opts.header, delimiter: opts.delimiter });
  }

  // Linked (LTAR/Links) cells must export every linked record, not just the
  // default nested page of 25 records (issue #9347). Build a per-relation-column
  // nested query that raises the limit to the system maximum; getListArgs clamps
  // it to defaultLimitConfig.limitMax, matching the V3 API's nested-record
  // ceiling. Applied to both the optimized (single-query) and nocoExecute read
  // paths since both derive the nested LTAR limit from `query.nested[col].limit`.
  private buildNestedLinkLimitQuery(
    model: Model,
  ): Record<string, { limit: number }> {
    const nested: Record<string, { limit: number }> = {};
    for (const column of model.columns) {
      if (isLinksOrLTAR(column)) {
        nested[column.title] = { limit: defaultLimitConfig.limitMax };
      }
    }
    return nested;
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
    fields: string[],
    header = false,
    delimiter = ',',
    dataExportMode = false,
    param?: {
      filterArrJson: any;
      sortArrJson: any;
      customConditions?: Filter[];
    },
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.datasService
        .dataList(context, {
          model,
          view,
          query: {
            limit,
            offset,
            fields,
            nested: this.buildNestedLinkLimitQuery(model),
            filterArrJson: param?.filterArrJson,
            sortArrJson: param?.sortArrJson,
          },
          baseModel,
          ignoreViewFilterAndSort: !dataExportMode,
          limitOverride: limit,
          skipSortBasedOnOrderCol: true,
          customConditions: param?.customConditions,
        })
        .then((result) => {
          if (result.list.length === 0 && offset === 0) {
            return getQueriedColumns(context, {
              model,
              view,
              fieldsSet: new Set(fields),
            }).then((columns) => {
              const titles = columns.map((col) => col.title);
              stream.push(
                unparse(
                  [dataExportMode ? escapeFormulaHeader(titles) : titles],
                  { header: true },
                ),
              );
              stream.push(null);
              resolve();
            });
          }
          try {
            if (!header) {
              stream.push('\r\n');
            }

            // check if formatter is async
            const formatterPromise = formatter(result.list);
            if (formatterPromise instanceof Promise) {
              formatterPromise.then(({ data }) => {
                if (dataExportMode) {
                  escapeFormulaeInRows(data, model.columns);
                }
                stream.push(
                  this.unparseExportRows(data, {
                    header,
                    delimiter,
                    escapeHeader: dataExportMode,
                  }),
                );
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
                    param,
                  )
                    .then(resolve)
                    .catch(reject);
                }
              });
            } else {
              if (dataExportMode) {
                escapeFormulaeInRows(formatterPromise.data, model.columns);
              }
              stream.push(
                this.unparseExportRows(formatterPromise.data, {
                  header,
                  escapeHeader: dataExportMode,
                }),
              );
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
                  param,
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
    fields: string[],
    header = false,
  ): Promise<boolean> {
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
          skipSortBasedOnOrderCol: true,
        })
        .then((result) => {
          try {
            const { data } = formatter(result.list);
            // `unparse([])` yields '' — no header row. Claiming a header the
            // stream never wrote would leave the next junction appending
            // headerless rows, whose first row papaparse then eats as a header.
            const wrote = !!data?.length;

            if (wrote) {
              if (!header) {
                linkStream.push('\r\n');
              }
              linkStream.push(unparse(data, { header }));
            }

            if (result.pageInfo.isLastPage) {
              resolve(wrote);
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
                // An empty page has not spent the header yet.
                header && !wrote,
              )
                .then((laterWrote) => resolve(wrote || laterWrote))
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

    const { serializedModels: exportedModels } = await this.serializeModels(
      context,
      {
        modelIds: models.map((m) => m.id),
      },
    );

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
      NcError.get(context).badRequest(e);
    }

    return {
      path: destPath,
    };
  }
}
