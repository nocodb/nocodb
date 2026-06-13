import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  type IntegrationReqType,
  IntegrationsType,
  isLinksOrLTAR,
  type MetaType,
  NcApiVersion,
  NcBaseError,
  type NcContext,
  type NcRequest,
  OperationSource,
  parseProp,
  PlanFeatureTypes,
  RelationTypes,
  SyncCategory,
  SyncTrigger,
  TARGET_TABLES_META,
  UITypes,
} from 'nocodb-sdk';
import {
  syncSystemFields,
  syncSystemFieldsMap,
} from '@noco-local-integrations/core';
import type { OnModuleInit } from '@nestjs/common';
import type { OnDeleteAction, SyncType } from 'nocodb-sdk';
import type {
  AuthIntegration,
  CustomSyncSchema,
  SyncIntegration,
} from '@noco-local-integrations/core';
import {
  Base,
  Column,
  Integration,
  Model,
  SyncConfig,
  SyncMapping,
  View,
  Workspace,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';
import { IntegrationsService } from '~/services/integrations.service';
import { TablesService } from '~/services/tables.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import {
  ColumnsService,
  getJunctionTableName,
} from '~/services/columns.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobStatus, JobTypes } from '~/interface/Jobs';
import { ViewColumnsService } from '~/services/view-columns.service';
import { getMMColumnNames } from '~/helpers/columnHelpers';
import { extractProps } from '~/helpers/extractProps';
import { checkForFeature } from '~/helpers/paymentHelpers';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class SyncModuleService implements OnModuleInit {
  private logger: Logger = new Logger(SyncModuleService.name);

  private async resolveAvailableTableTitle(
    context: NcContext,
    base: Base,
    source: { id?: string },
    desiredTitle: string,
  ): Promise<{ title: string; table_name: string }> {
    const baseTableName =
      desiredTitle.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || desiredTitle;
    for (let i = 0; i < 1000; i++) {
      const title = i === 0 ? desiredTitle : `${desiredTitle} (${i})`;
      const table_name = i === 0 ? baseTableName : `${baseTableName}_${i}`;
      const [titleOk, tableNameOk] = await Promise.all([
        Model.checkAliasAvailable(context, {
          title,
          base_id: base.id!,
          source_id: source.id,
        } as any),
        Model.checkTitleAvailable(context, {
          table_name,
          base_id: base.id!,
          source_id: source.id,
        } as any),
      ]);
      if (titleOk && tableNameOk) return { title, table_name };
    }
    NcError.badRequest(
      `Could not allocate a unique table name for "${desiredTitle}"`,
    );
  }

  constructor(
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly integrationsService: IntegrationsService,
    protected readonly tablesService: TablesService,
    protected readonly bulkDataAliasService: BulkDataAliasService,
    protected readonly columnsService: ColumnsService,
    protected readonly viewColumnsService: ViewColumnsService,
    protected readonly baseTrashService: BaseTrashService,
  ) {}

  async onModuleInit() {
    this.nocoJobsService.jobsQueue.add(
      {
        jobName: JobTypes.SyncModuleSchedule,
      },
      {
        jobId: JobTypes.SyncModuleSchedule,
        repeat: { cron: '* * * * *' },
      },
    );
  }

  @TraceCommand(OperationName.appSyncCreate)
  async createSync(
    context: NcContext,
    payload: {
      title: string;
      sync_type: SyncType;
      sync_trigger: SyncTrigger;
      sync_trigger_cron?: string;
      on_delete_action: OnDeleteAction;
      sync_category: SyncCategory;
      configs: IntegrationReqType[];
      meta: MetaType;
    },
    req: NcRequest,
  ) {
    const {
      title,
      sync_type,
      sync_trigger,
      sync_category,
      sync_trigger_cron,
      on_delete_action,
      configs,
      meta,
    } = payload;

    if (!title || !sync_type || !sync_trigger || !sync_category) {
      NcError.badRequest('Invalid sync config');
    }

    for (const config of configs) {
      if (config.type !== IntegrationsType.Sync) {
        NcError.badRequest('Integration is not a sync integration');
      }

      if (!config.config?.authIntegrationId) {
        NcError.badRequest('Invalid sync config');
      }
    }

    const mainConfig = configs.shift();

    if (!mainConfig) {
      NcError.badRequest('Invalid sync config');
    }

    // Derive the sync category from the integration manifest — the source of
    // truth — instead of trusting the client-supplied `sync_category`. Without
    // this, the Enterprise custom-sync gate can be bypassed by sending a
    // non-CUSTOM `sync_category` for a custom (e.g. mssql) sync integration.
    const resolvedSyncCategory =
      Integration.getManifestForConfig(mainConfig)?.sync_category ??
      sync_category;

    // Custom sync is an Enterprise-only feature
    if (resolvedSyncCategory === SyncCategory.CUSTOM) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_CUSTOM_SYNC);
    }

    const workspaceId = context.workspace_id;
    const baseId = context.base_id;

    const workspace = await Workspace.get(workspaceId);

    if (!workspace) {
      NcError.workspaceNotFound(workspaceId);
    }

    const base = await Base.getWithInfo(context, baseId);

    if (!base) {
      NcError.baseNotFound(baseId);
    }

    const source = base.sources.find((s) => s.isMeta());

    if (!source) {
      NcError.sourceNotFound(baseId);
    }

    const integrationsToDelete: Integration[] = [];
    const syncConfigsToDelete: SyncConfig[] = [];

    try {
      const tempIntegrationWrapper = Integration.tempIntegrationWrapper(
        mainConfig,
      ) as SyncIntegration;

      if (!mainConfig.title) {
        Object.assign(mainConfig, {
          title: tempIntegrationWrapper.getTitle(),
        });
      }

      const mainIntegration = await this.integrationsService.integrationCreate(
        context,
        {
          workspaceId,
          integration: mainConfig,
          req,
        },
      );

      integrationsToDelete.push(mainIntegration);

      const mainIntegrationWithConfig = await Integration.get(
        context,
        mainIntegration.id,
      );

      const wrapper =
        await mainIntegrationWithConfig.getIntegrationWrapper<SyncIntegration>();

      const authIntegration = await Integration.get(
        context,
        mainConfig.config.authIntegrationId,
      );

      if (!authIntegration) {
        NcError.genericNotFound(
          'AuthIntegration',
          mainConfig.config.authIntegrationId,
        );
      }

      const authWrapper =
        await authIntegration.getIntegrationWrapper<AuthIntegration>();

      await authWrapper.authenticate();

      const schema = await wrapper.getDestinationSchema(authWrapper);

      if (!schema || Object.keys(schema).length === 0) {
        NcError.badRequest('No tables found in the schema');
      }

      const syncConfig = await SyncConfig.insert(context, {
        fk_integration_id: mainIntegration.id,
        title,
        sync_type,
        sync_trigger,
        sync_trigger_cron,
        sync_category: resolvedSyncCategory,
        on_delete_action,
        created_by: req.user.id,
        updated_by: req.user.id,
        meta,
      });

      syncConfigsToDelete.push(syncConfig);

      for (const childConfig of configs) {
        const tempIntegrationWrapper = Integration.tempIntegrationWrapper(
          childConfig,
        ) as SyncIntegration;

        if (!childConfig.title) {
          Object.assign(childConfig, {
            title: tempIntegrationWrapper.getTitle(),
          });
        }

        const childIntegration =
          await this.integrationsService.integrationCreate(context, {
            workspaceId,
            integration: childConfig,
            req,
          });

        integrationsToDelete.push(childIntegration);

        const childSyncConfig = await SyncConfig.insert(context, {
          fk_integration_id: childIntegration.id,
          fk_parent_sync_config_id: syncConfig.id,
          created_by: req.user.id,
          updated_by: req.user.id,
        });

        syncConfigsToDelete.push(childSyncConfig);
      }

      const syncMappings: SyncMapping[] = [];
      const schemaKeyTableMap: Map<string, Model> = new Map();
      const tablesToDelete: Model[] = [];
      try {
        for (const [tableKey, tableSchema] of Object.entries(schema)) {
          const tableMeta = TARGET_TABLES_META[tableKey];

          if (
            parseProp(meta).sync_excluded_models?.includes(tableKey) &&
            !tableMeta.required
          ) {
            continue;
          }

          const { title: tableTitle, table_name: tableNameSafe } =
            await this.resolveAvailableTableTitle(
              context,
              base,
              source,
              tableSchema.title,
            );

          // Add system fields to the columns
          const columns = [...tableSchema.columns, ...syncSystemFields];

          // for custom schema
          if (tableSchema.systemFields?.primaryKey?.length) {
            // first non-pk column is pv
            const pvColumn = columns.find(
              (col) => !tableSchema.systemFields.primaryKey.includes(col.title),
            );

            if (pvColumn) {
              pvColumn.pv = true;
            }
          }

          const model = await this.tablesService.tableCreate(
            {
              ...context,
              socket_id: null,
            },
            {
              baseId: base.id,
              table: {
                title: tableTitle,
                table_name: tableNameSafe,
                columns: columns
                  .filter((column) => !column.exclude)
                  .map((column) => ({
                    title: column.title,
                    column_name: column.column_name || column.title,
                    uidt: column.uidt as UITypes,
                    readonly: true,
                    pv: column.pv,
                    meta: column.meta,
                    system: !!syncSystemFieldsMap[column.title],
                  })),
              },
              apiVersion: NcApiVersion.V3,
              synced: true,
              operationSource: OperationSource.SYNC,
              user: req.user,
              req,
            },
          );

          // Hide syncSystemFields from default view
          const defaultView = await View.getFirstCollaborativeView(
            context,
            model.id,
          );

          await this.viewColumnsService.columnsUpdate(
            {
              ...context,
              socket_id: null,
            },
            {
              viewId: defaultView.id,
              columns: model.columns
                .filter((column) => !!syncSystemFieldsMap[column.title])
                .map((column) => {
                  return {
                    id: column.id,
                    show: false,
                  };
                }),
              req,
            },
          );

          schemaKeyTableMap.set(tableKey, model);
          tablesToDelete.push(model);

          const syncMapping = await SyncMapping.insert(context, {
            fk_sync_config_id: syncConfig.id,
            target_table: tableKey,
            fk_model_id: model.id,
          });

          syncMappings.push(syncMapping);
        }

        // create relations between tables
        for (const [tableKey, table] of schemaKeyTableMap.entries()) {
          const tableSchema = schema[tableKey as keyof typeof schema];

          for (const relation of tableSchema.relations) {
            // create relations
            const relatedTable = schemaKeyTableMap.get(relation.relatedTable);

            if (!relatedTable) {
              this.logger.warn(
                `Related table "${relation.relatedTable}" not found, skipping`,
              );
              continue;
            }

            const jnTableTitle = await getJunctionTableName(
              {
                base,
              },
              table,
              relatedTable,
            );

            const { parentCn, childCn } = getMMColumnNames(table, relatedTable);

            // create junction table
            const junctionTable = await this.tablesService.tableCreate(
              {
                ...context,
                socket_id: null,
              },
              {
                baseId: base.id,
                user: req.user,
                req,
                apiVersion: NcApiVersion.V3,
                table: {
                  title: jnTableTitle,
                  columns: [
                    {
                      title: parentCn,
                      column_name: parentCn,
                      uidt: 'SingleLineText',
                      readonly: true,
                    },
                    {
                      title: childCn,
                      column_name: childCn,
                      uidt: 'SingleLineText',
                      readonly: true,
                    },
                    ...syncSystemFields.map((field) => ({
                      ...field,
                      readonly: true,
                      system: true,
                    })),
                  ],
                },
                synced: true,
                mm: true,
                operationSource: OperationSource.SYNC,
              },
            );

            await SyncMapping.insert(context, {
              fk_sync_config_id: syncConfig.id,
              target_table: null,
              fk_model_id: junctionTable.id,
            });

            tablesToDelete.push(junctionTable);

            await table.getColumns(context);
            await relatedTable.getColumns(context);
            await junctionTable.getColumns(context);

            const remoteIdParentColumn = table.columns.find(
              (c) => c.column_name === 'remote_id',
            );

            const remoteIdChildColumn = relatedTable.columns.find(
              (c) => c.column_name === 'remote_id',
            );

            const parentColumn = junctionTable.columns.find(
              (c) => c.column_name === parentCn,
            );

            const childColumn = junctionTable.columns.find(
              (c) => c.column_name === childCn,
            );

            if (
              !remoteIdParentColumn ||
              !remoteIdChildColumn ||
              !parentColumn ||
              !childColumn
            ) {
              throw new Error(
                `Sync relation '${relation.columnTitle}' missing junction columns on ${table.title} ↔ ${relatedTable.title}`,
              );
            }

            const column = await this.columnsService.columnAdd(
              {
                ...context,
                socket_id: null,
              },
              {
                tableId: table.id,
                column: {
                  title: relation.columnTitle,
                  column_name: relation.columnTitle
                    .replace(/\W/g, '_')
                    .toLowerCase(),
                  uidt: UITypes.LinkToAnotherRecord,
                  type: RelationTypes.MANY_TO_MANY,
                  readonly: true,
                  ...{
                    is_custom_link: true,
                    custom: {
                      base_id: base.id,
                      column_id: remoteIdParentColumn.id,
                      junc_base_id: base.id,
                      junc_model_id: junctionTable.id,
                      junc_column_id: parentColumn.id,
                      junc_ref_column_id: childColumn.id,
                      ref_model_id: relatedTable.id,
                      ref_column_id: remoteIdChildColumn.id,
                    },
                  },
                } as any,
                user: req.user,
                req,
                apiVersion: NcApiVersion.V3,
              },
            );

            // rename the column of the related table
            await relatedTable.getColumns(context);

            const relatedTableColumn = relatedTable.columns.find(
              (c) =>
                c.colOptions?.fk_mm_model_id ===
                column.colOptions.fk_mm_model_id,
            );

            if (relatedTableColumn) {
              await this.columnsService.columnUpdate(
                {
                  ...context,
                  socket_id: null,
                },
                {
                  columnId: relatedTableColumn.id,
                  column: {
                    ...relatedTableColumn,
                    title: relation.relatedTableColumnTitle,
                  },
                  user: req.user,
                  req,
                  apiVersion: NcApiVersion.V3,
                  bypassSyncedFieldGuard: true,
                },
              );
            }
          }
        }
      } catch (e) {
        this.logger.error(
          `Sync create failed: ${(e as Error)?.message ?? e}`,
          (e as Error)?.stack,
        );

        for (const table of tablesToDelete) {
          try {
            if (table.mm) {
              await Model.markAsMmTable(context, table.id, false);
            }
            await this.tablesService.tableDelete(
              {
                ...context,
                socket_id: null,
              },
              {
                tableId: table.id,
                forceDeleteSyncs: true,
                skipTrash: true,
                req,
              },
            );
          } catch (cleanupErr) {
            this.logger.error(
              `Sync cleanup: failed to drop table ${table.id}: ${
                (cleanupErr as Error)?.message ?? cleanupErr
              }`,
              (cleanupErr as Error)?.stack,
            );
          }
        }

        for (const syncMapping of syncMappings) {
          await SyncMapping.delete(context, syncMapping.id);
        }
        if (e instanceof NcError || e instanceof NcBaseError) throw e;
        this.logger.error(
          `Failed to create sync: ${(e as any)?.message ?? e}`,
          (e as any)?.stack,
        );
        NcError.get(context).internalServerError('Failed to create sync');
      }

      if (authWrapper?.destroy) {
        await authWrapper.destroy();
      }

      const job = await this.triggerSync(context, {
        syncConfigId: syncConfig.id,
        bulk: true,
        req,
      });

      const config = await SyncConfig.get(context, syncConfig.id);

      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'app_sync_create',
            payload: { ...config, base_id: context.base_id },
          },
        },
        context.socket_id,
      );

      return {
        integrations: integrationsToDelete,
        syncConfig: config,
        job: {
          id: job.id,
        },
      };
    } catch (e) {
      for (const integration of integrationsToDelete) {
        const integrationModel = await Integration.get(context, integration.id);
        if (integrationModel) {
          await this.integrationsService.integrationDelete(context, {
            integrationId: integration.id,
            req,
            force: false,
          });
        }
      }

      for (const syncConfig of syncConfigsToDelete) {
        await SyncConfig.delete(context, syncConfig.id);
      }
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error('Failed to create sync', e);
      NcError.get(context).internalServerError('Failed to create sync');
    }
  }

  async triggerSync(
    context: NcContext,
    args: {
      syncConfigId: string;
      bulk?: boolean;
      trigger?: SyncTrigger;
      fullResync?: boolean;
      req?: NcRequest;
    },
  ) {
    const {
      syncConfigId,
      bulk,
      trigger = SyncTrigger.Manual,
      fullResync,
      req,
    } = args;

    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.get(context).syncConfigNotFound(syncConfigId);
    }

    if (syncConfig.sync_job_id) {
      const job = await this.nocoJobsService.getJob(syncConfig.sync_job_id);

      if (job) {
        const status = await job.getState();

        if (
          ![JobStatus.COMPLETED, JobStatus.FAILED].includes(status as JobStatus)
        ) {
          // A run is already in flight and the processor rejects concurrent
          // runs, so we can't enqueue a second job now. If this trigger asked
          // for a full resync (e.g. a schema change added/changed columns),
          // park the intent so the running job promotes itself to a full
          // resync on completion — otherwise the schema delta is silently
          // dropped and the new columns never get backfilled.
          if (fullResync) {
            await SyncConfig.update(context, syncConfig.id, {
              meta: {
                ...(parseProp(syncConfig.meta) || {}),
                pending_full_resync: true,
              },
            });
          }

          return {
            id: job.id,
          };
        }
      }

      await SyncConfig.update(context, syncConfig.id, {
        sync_job_id: null,
      });
    }

    const job = await this.nocoJobsService.add(JobTypes.SyncModuleSyncData, {
      context,
      syncConfigId: syncConfig.id,
      trigger,
      bulk,
      fullResync,
      req,
    });

    await SyncConfig.update(context, syncConfig.id, {
      sync_job_id: `${job.id}`,
    });

    return {
      id: job.id,
    };
  }

  async migrateSync(context: NcContext, syncConfigId: string, req: NcRequest) {
    if (process.env.TEST !== 'true') {
      NcError.badRequest('Migration is only allowed in development mode');
    }

    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.get(context).syncConfigNotFound(syncConfigId);
    }

    const job = await this.nocoJobsService.add(JobTypes.SyncModuleMigrateSync, {
      context,
      syncConfigId: syncConfig.id,
      req,
    });

    return {
      id: job.id,
    };
  }

  private async detachTableFromSync(
    context: NcContext,
    args: { mapping?: SyncMapping; model: Model },
  ) {
    const { mapping, model } = args;

    if (mapping) {
      await SyncMapping.delete(context, mapping.id);
    }

    await Model.updateSynced(context, model.id, false);

    const columns = await model.getColumns(context);
    for (const column of columns ?? []) {
      if (column.readonly && column.id) {
        await Column.update2(context, {
          colId: column.id,
          column: { readonly: false },
          isSimpleUpdate: true,
        });
      }
    }
  }

  /** One `table_update` so live clients refresh the tree/grid after a
   *  table's `synced` flag + column `readonly` flags flip (detach/attach). */
  private async broadcastTableUpdate(context: NcContext, tableId: string) {
    const table = await Model.getWithInfo(context, { id: tableId });
    if (!table) return;

    NocoSocket.broadcastEvent(context, {
      event: EventType.META_EVENT,
      payload: { action: 'table_update', payload: table },
    });
  }

  /**
   * "Convert to regular table" — the only way an app-sync destination table
   * leaves its sync. After this the table is a plain editable table: delete,
   * trash, restore and undo/redo need no sync awareness (synced tables are
   * blocked from deletion/trash entirely).
   */
  @TraceCommand(OperationName.appSyncDetachTable)
  async detachSyncTable(
    context: NcContext,
    param: { modelId: string; req: NcRequest },
  ) {
    const { modelId } = param;

    const mappings = await SyncMapping.listByModelId(context, modelId);
    const mapping = mappings[0];

    if (!mapping) {
      NcError.get(context).invalidRequestBody('Table is not managed by a sync');
    }

    const model = await Model.get(context, modelId);

    if (!model) {
      NcError.get(context).tableNotFound(modelId);
    }

    if (model.mm || !mapping.target_table) {
      NcError.get(context).invalidRequestBody(
        'Junction tables cannot be converted on their own — convert the linked table instead',
      );
    }

    // Sync-managed M2M links span a junction table the sync also owns.
    // Converting this table hands those LINKS over to the user as well: the
    // junction detaches with it and the mirrored link column on the (still
    // synced) related table becomes editable. The data processor skips link
    // pushes whose junction is no longer synced, so the sync never fights
    // the user's manual link edits afterwards.
    const touchedRelatedModelIds = new Set<string>();
    const columns = await model.getColumns(context);
    for (const column of columns ?? []) {
      if (!isLinksOrLTAR(column)) continue;

      const colOptions = await column.getColOptions<{
        fk_mm_model_id?: string;
        fk_related_model_id?: string;
      }>(context);

      if (!colOptions?.fk_mm_model_id) continue;

      const junction = await Model.get(context, colOptions.fk_mm_model_id);
      if (!junction?.mm || !junction?.synced) continue;

      const junctionMappings = await SyncMapping.listByModelId(
        context,
        junction.id,
      );

      await this.detachTableFromSync(context, {
        mapping: junctionMappings[0],
        model: junction,
      });

      // The mirrored link column on the related table becomes a normal,
      // user-editable link too.
      if (colOptions.fk_related_model_id) {
        const related = await Model.get(
          context,
          colOptions.fk_related_model_id,
        );
        const relatedColumns = await related?.getColumns(context);

        for (const relatedColumn of relatedColumns ?? []) {
          if (!isLinksOrLTAR(relatedColumn) || !relatedColumn.readonly) {
            continue;
          }

          const relatedColOptions = await relatedColumn.getColOptions<{
            fk_mm_model_id?: string;
          }>(context);

          if (
            relatedColOptions?.fk_mm_model_id === junction.id &&
            relatedColumn.id
          ) {
            await Column.update2(context, {
              colId: relatedColumn.id,
              column: { readonly: false },
              isSimpleUpdate: true,
            });
            touchedRelatedModelIds.add(colOptions.fk_related_model_id);
          }
        }
      }
    }

    await this.detachTableFromSync(context, { mapping, model });

    // Realtime: the converted table (and any related table whose mirrored
    // link column became editable) changed shape for every client.
    await this.broadcastTableUpdate(context, model.id);
    for (const relatedId of touchedRelatedModelIds) {
      await this.broadcastTableUpdate(context, relatedId);
    }

    // Drop the table from the owning integration's selection so the sync
    // config no longer references it.
    const syncConfig = await SyncConfig.get(context, mapping.fk_sync_config_id);
    const integration = syncConfig?.fk_integration_id
      ? await Integration.get(context, syncConfig.fk_integration_id)
      : null;

    if (integration) {
      const config = await integration.getConfig();
      const newConfig = { ...config };
      let configChanged = false;

      if (Array.isArray(config?.tables)) {
        newConfig.tables = config.tables.filter(
          (table: string) => table !== mapping.target_table,
        );
        configChanged ||= newConfig.tables.length !== config.tables.length;
      }

      if (config?.custom_schema?.[mapping.target_table]) {
        newConfig.custom_schema = { ...config.custom_schema };
        delete newConfig.custom_schema[mapping.target_table];
        configChanged = true;
      }

      if (configChanged) {
        await Integration.updateIntegration(context, integration.id, {
          config: newConfig,
        });
      }
    }

    const updated = await SyncConfig.get(context, mapping.fk_sync_config_id);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'app_sync_update',
          payload: { ...updated, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return updated;
  }

  /**
   * Replay-only inverse of `detachSyncTable` (undo of "convert to regular
   * table"): recreate the mapping, re-flag synced/readonly — incl. handed-over
   * junctions and the mirrored link columns — and put the table back into the
   * integration's `tables`/`custom_schema`. Best-effort guards throughout:
   * anything deleted since the detach is skipped.
   */
  async attachSyncTable(
    context: NcContext,
    param: {
      modelId: string;
      syncConfigId: string;
      targetTable: string;
      readonlyColIds: string[];
      customSchemaEntry?: unknown;
      junctions?: Array<{
        junctionId: string;
        relatedReadonlyColIds: string[];
      }>;
      req: NcRequest;
    },
  ) {
    const {
      modelId,
      syncConfigId,
      targetTable,
      readonlyColIds,
      customSchemaEntry,
      junctions,
    } = param;

    const model = await Model.get(context, modelId);
    if (!model) {
      NcError.get(context).tableNotFound(modelId);
    }

    const syncConfig = await SyncConfig.get(context, syncConfigId);
    if (!syncConfig) {
      NcError.get(context).syncConfigNotFound(syncConfigId);
    }

    const reAttachedRelatedModelIds = new Set<string>();

    const existing = await SyncMapping.listByModelId(context, modelId);
    if (!existing.length) {
      await SyncMapping.insert(context, {
        fk_sync_config_id: syncConfigId,
        target_table: targetTable,
        fk_model_id: modelId,
      });
    }

    await Model.updateSynced(context, modelId, true);

    for (const colId of readonlyColIds ?? []) {
      const column = await Column.get(context, { colId });
      if (!column) continue;
      await Column.update2(context, {
        colId,
        column: { readonly: true },
        isSimpleUpdate: true,
      });
    }

    for (const junction of junctions ?? []) {
      const junctionModel = await Model.get(context, junction.junctionId);
      if (!junctionModel) continue;

      await Model.updateSynced(context, junction.junctionId, true);

      const junctionMappings = await SyncMapping.listByModelId(
        context,
        junction.junctionId,
      );
      if (!junctionMappings.length) {
        await SyncMapping.insert(context, {
          fk_sync_config_id: syncConfigId,
          target_table: null,
          fk_model_id: junction.junctionId,
        });
      }

      for (const colId of junction.relatedReadonlyColIds ?? []) {
        const column = await Column.get(context, { colId });
        if (!column) continue;
        await Column.update2(context, {
          colId,
          column: { readonly: true },
          isSimpleUpdate: true,
        });
        if (column.fk_model_id) {
          reAttachedRelatedModelIds.add(column.fk_model_id);
        }
      }
    }

    await this.broadcastTableUpdate(context, modelId);
    for (const relatedId of reAttachedRelatedModelIds) {
      await this.broadcastTableUpdate(context, relatedId);
    }

    // Put the table back into the owning integration's selection.
    const integration = syncConfig.fk_integration_id
      ? await Integration.get(context, syncConfig.fk_integration_id)
      : null;
    if (integration) {
      const config = await integration.getConfig();
      const newConfig = { ...config };
      let configChanged = false;

      if (
        Array.isArray(config?.tables) &&
        !config.tables.includes(targetTable)
      ) {
        newConfig.tables = [...config.tables, targetTable];
        configChanged = true;
      }
      if (customSchemaEntry && !config?.custom_schema?.[targetTable]) {
        newConfig.custom_schema = {
          ...(config?.custom_schema ?? {}),
          [targetTable]: customSchemaEntry,
        };
        configChanged = true;
      }
      if (configChanged) {
        await Integration.updateIntegration(context, integration.id, {
          config: newConfig,
        });
      }
    }

    const updated = await SyncConfig.get(context, syncConfigId);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'app_sync_update',
          payload: { ...updated, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return updated;
  }

  async listSync(context: NcContext, _req: NcRequest) {
    return await SyncConfig.list(context);
  }

  async readSync(context: NcContext, syncConfigId: string) {
    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.get(context).syncConfigNotFound(syncConfigId);
    }

    return syncConfig;
  }

  /**
   * Glue child of the `appSyncUpdate` macro. Applies the scalar config fields
   * (top-level only) and persists each integration's `custom_schema` (+ removed-
   * namespace data cleanup) as ONE traced, reversible op, so it lands in the
   * macro transcript alongside the table/column ops. `updateSync` calls this in
   * place of doing those mutations inline; the table/column changes stay as
   * their own transcript children and mappings ride the table ops' trash cycle.
   */
  @TraceCommand(OperationName.appSyncConfigUpdate)
  async appSyncConfigUpdate(
    context: NcContext,
    param: {
      syncConfigId: string;
      payload: {
        title?: string;
        sync_type?: SyncType;
        sync_trigger?: SyncTrigger;
        sync_trigger_cron?: string;
        on_delete_action?: OnDeleteAction;
        config?:
          | (IntegrationReqType & { id?: string })
          | (IntegrationReqType & { id?: string })[];
      };
      req: NcRequest;
    },
  ): Promise<{ integrations: Integration[] }> {
    const { syncConfigId, payload, req } = param;
    const syncConfig = await SyncConfig.get(context, syncConfigId);
    if (!syncConfig) {
      NcError.get(context).syncConfigNotFound(syncConfigId);
    }

    // Scalar config fields — top-level syncs only.
    const scalarProps = extractProps(payload, [
      'title',
      'sync_type',
      'sync_trigger',
      'sync_trigger_cron',
      'on_delete_action',
    ]);
    if (
      !syncConfig.fk_parent_sync_config_id &&
      Object.keys(scalarProps).length
    ) {
      await SyncConfig.update(context, syncConfigId, {
        ...scalarProps,
        updated_by: req.user.id,
      });
    }

    const updatedIntegrations: Integration[] = [];
    for (const integrationPayload of [payload.config].flat().filter(Boolean)) {
      if (!integrationPayload?.id) continue;
      const integration = await Integration.get(context, integrationPayload.id);
      if (!integration) continue;

      const integrationWrapper =
        await integration.getIntegrationWrapper<SyncIntegration>();
      const tempIntegrationWrapper = Integration.tempIntegrationWrapper(
        integrationPayload,
      ) as SyncIntegration;
      const oldNamespaces = await integrationWrapper.getNamespaces();
      const newNamespaces = await tempIntegrationWrapper.getNamespaces();
      const namespacesToDelete = oldNamespaces.filter(
        (namespace) => !newNamespaces.includes(namespace),
      );

      const updated = await this.integrationsService.integrationUpdate(
        context,
        {
          integrationId: integrationPayload.id,
          integration: integrationPayload,
          req,
        },
      );
      updatedIntegrations.push(updated);

      if (namespacesToDelete.length > 0) {
        const syncMappings = await SyncMapping.list(context, {
          fk_sync_config_id:
            syncConfig.fk_parent_sync_config_id || syncConfig.id,
          force: true,
        });
        for (const syncMapping of syncMappings) {
          const model = await Model.get(context, syncMapping.fk_model_id);
          if (!model) continue;
          await model.getColumns(context);
          const remoteNamespaceColId = model.columns.find(
            (c) => c.title === 'RemoteNamespace',
          )?.id;
          if (!remoteNamespaceColId) {
            continue;
          }
          await this.bulkDataAliasService.bulkDataDeleteAll(
            { ...context, socket_id: null },
            {
              baseName: model.base_id,
              tableName: model.id,
              req,
              query: {
                internalFlags: { skipHooks: true },
                filterArr: [
                  {
                    comparison_op: 'in',
                    value: namespacesToDelete,
                    logical_op: 'and',
                    fk_column_id: remoteNamespaceColId,
                  },
                ],
              },
            },
          );
        }
      }
    }

    const updated = await SyncConfig.get(context, syncConfigId);
    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'app_sync_update',
          payload: { ...updated, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return { integrations: updatedIntegrations };
  }

  @TraceCommand(OperationName.appSyncUpdate)
  async updateSync(
    context: NcContext,
    param: {
      syncConfigId: string;
      payload: {
        title?: string;
        sync_type?: SyncType;
        sync_trigger?: SyncTrigger;
        sync_trigger_cron?: string;
        on_delete_action?: OnDeleteAction;
        config?:
          | (IntegrationReqType & { id?: string; syncConfigId?: string })
          | (IntegrationReqType & { id?: string; syncConfigId?: string })[];
      };
      req: NcRequest;
    },
  ) {
    const { syncConfigId, payload, req } = param;
    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.get(context).syncConfigNotFound(syncConfigId);
    }

    const configsToProcess = [payload.config].flat().filter(Boolean);

    const updatedIntegrations: Integration[] = [];
    let schemaChanged = false;

    const scalarProps = extractProps(payload, [
      'title',
      'sync_type',
      'sync_trigger',
      'sync_trigger_cron',
      'on_delete_action',
    ]);
    if (
      !syncConfig.fk_parent_sync_config_id &&
      Object.keys(scalarProps).length
    ) {
      await this.appSyncConfigUpdate(context, {
        syncConfigId,
        payload: scalarProps,
        req,
      });
    }

    // Process all integration configs
    for (const integrationPayload of configsToProcess) {
      if (integrationPayload.id) {
        // Update existing integration
        const integration = await Integration.get(
          context,
          integrationPayload.id,
        );

        if (!integration) {
          this.logger.warn(
            `Integration ${integrationPayload.id} not found, skipping`,
          );
          continue;
        }

        if (integrationPayload.config?.custom_schema) {
          const syncMappings = await SyncMapping.list(context, {
            fk_sync_config_id:
              syncConfig.fk_parent_sync_config_id || syncConfig.id,
            force: true,
          });

          const oldConfig = await integration.getConfig();

          const oldCustomSchema = oldConfig.custom_schema as CustomSyncSchema;
          const newCustomSchema = integrationPayload.config
            .custom_schema as CustomSyncSchema;

          const tablesToCreate = Object.keys(newCustomSchema).filter(
            (newTableKey) =>
              !Object.keys(oldCustomSchema).includes(newTableKey),
          );

          const tablesToDrop = Object.keys(oldCustomSchema).filter(
            (oldTableKey) =>
              !Object.keys(newCustomSchema).includes(oldTableKey),
          );

          // tables to modify are the ones that exist in both old and new schema with extra columns or uidt mismatch
          const tablesToModify = Object.keys(newCustomSchema).filter(
            (newTableKey) => {
              const oldTable = oldCustomSchema[newTableKey];
              const newTable = newCustomSchema[newTableKey];
              if (!oldTable || !newTable) {
                return false;
              }

              for (const column of newTable.columns) {
                const oldColumn = oldTable.columns.find(
                  (col) => col.title === column.title,
                );
                if (
                  !oldColumn ||
                  oldColumn.exclude !== column.exclude ||
                  oldColumn.uidt !== column.uidt
                ) {
                  return true;
                }
              }

              return false;
            },
          );

          for (const tableKey of tablesToCreate) {
            const activeMapping = syncMappings.find(
              (m) => m.target_table === tableKey,
            );

            if (activeMapping) {
              const existingModel = await Model.get(
                context,
                activeMapping.fk_model_id,
              );

              if (existingModel) {
                continue;
              }

              await SyncMapping.delete(context, activeMapping.id);
            }

            const table = newCustomSchema[tableKey];

            const columns = [...table.columns, ...syncSystemFields];

            if (table.systemFields?.primaryKey?.length) {
              const pvColumn = columns.find(
                (col) => !table.systemFields.primaryKey.includes(col.title),
              );

              if (pvColumn) {
                pvColumn.pv = true;
              }
            }

            const base = await Base.getWithInfo(context, context.base_id);
            const source = base?.sources?.find((s) => s.isMeta());
            const { title: tableTitle, table_name: tableNameSafe } =
              await this.resolveAvailableTableTitle(
                context,
                base,
                source,
                table.title,
              );

            const model = await this.tablesService.tableCreate(
              {
                ...context,
                socket_id: null,
              },
              {
                baseId: context.base_id,
                table: {
                  title: tableTitle,
                  table_name: tableNameSafe,
                  columns: columns
                    .filter((column) => !column.exclude)
                    .map((column) => ({
                      title: column.title,
                      column_name: column.column_name || column.title,
                      uidt: column.uidt as UITypes,
                      readonly: true,
                      pv: column.pv,
                      meta: column.meta,
                      system: !!syncSystemFieldsMap[column.title],
                    })),
                },
                apiVersion: NcApiVersion.V3,
                synced: true,
                operationSource: OperationSource.SYNC,
                user: req.user,
                req,
              },
            );

            const defaultView = await View.getFirstCollaborativeView(
              context,
              model.id,
            );

            await this.viewColumnsService.columnsUpdate(
              {
                ...context,
                socket_id: null,
              },
              {
                viewId: defaultView.id,
                columns: model.columns
                  .filter((column) => !!syncSystemFieldsMap[column.title])
                  .map((column) => ({
                    id: column.id,
                    show: false,
                  })),
                req,
              },
            );

            const syncMapping = await SyncMapping.insert(context, {
              fk_sync_config_id: syncConfig.id,
              target_table: tableKey,
              fk_model_id: model.id,
            });

            syncMappings.push(syncMapping);
          }

          for (const tableKey of tablesToDrop) {
            const mapping = syncMappings.find(
              (m) => m.target_table === tableKey,
            );

            if (!mapping) {
              continue;
            }

            const model = await Model.get(context, mapping.fk_model_id);

            if (model) {
              if (model.mm) {
                await Model.markAsMmTable(context, model.id, false);
              }

              await this.tablesService.tableDelete(
                { ...context, socket_id: null },
                {
                  tableId: model.id,
                  forceDeleteSyncs: true,
                  forceDeleteRelations: true,
                  skipTrash: true,
                  req,
                },
              );
            }

            await SyncMapping.delete(context, mapping.id);
          }

          for (const tableKey of tablesToModify) {
            const mapping = syncMappings.find(
              (m) => m.target_table === tableKey,
            );

            if (!mapping) {
              continue;
            }

            const model = await Model.get(context, mapping.fk_model_id);
            if (model) {
              const table = newCustomSchema[tableKey];

              const existingSyncColumns = (
                await model.getColumns(context)
              ).filter(
                (col) => col.readonly && !syncSystemFieldsMap[col.title],
              );

              for (const column of table.columns) {
                const existingColumn = existingSyncColumns.find(
                  (col) => col.title === column.title,
                );

                if (existingColumn) {
                  if (existingColumn.uidt === column.uidt) continue; // no change needed

                  await this.columnsService.columnUpdate(
                    {
                      ...context,
                      socket_id: null,
                    },
                    {
                      columnId: existingColumn.id,
                      column: {
                        title: column.title,
                        column_name: column.column_name || column.title,
                        uidt: column.uidt,
                        readonly: true,
                      },
                      forceUpdateSystem: true,
                      user: req.user,
                      req,
                      bypassSyncedFieldGuard: true,
                    },
                  );
                } else {
                  if (column.exclude) continue;

                  await this.columnsService.columnAdd(
                    {
                      ...context,
                      socket_id: null,
                    },
                    {
                      tableId: model.id,
                      column: {
                        title: column.title,
                        column_name: column.column_name || column.title,
                        uidt: column.uidt,
                        readonly: true,
                      },
                      user: req.user,
                      req,
                    },
                  );
                }
              }

              for (const existingColumn of existingSyncColumns) {
                const column = table.columns.find(
                  (col) => col.title === existingColumn.title,
                );

                if (!column || column.exclude) {
                  await this.columnsService.columnDelete(
                    {
                      ...context,
                      socket_id: null,
                    },
                    {
                      columnId: existingColumn.id,
                      forceDeleteSystem: true,
                      skipTrash: true,
                      req,
                    },
                  );
                }
              }
            }
          }

          schemaChanged = true;
        }

        const { integrations: persisted } = await this.appSyncConfigUpdate(
          context,
          { syncConfigId, payload: { config: integrationPayload }, req },
        );
        updatedIntegrations.push(...persisted);
      } else {
        // Create new child sync config — gate on the integration manifest's
        // category (source of truth) so a custom (e.g. mssql) integration can't
        // be added to an existing sync without the Enterprise entitlement.
        if (
          Integration.getManifestForConfig(integrationPayload)
            ?.sync_category === SyncCategory.CUSTOM
        ) {
          await checkForFeature(context, PlanFeatureTypes.FEATURE_CUSTOM_SYNC);
        }

        const tempIntegrationWrapper = Integration.tempIntegrationWrapper(
          integrationPayload,
        ) as SyncIntegration;

        if (!integrationPayload.title) {
          Object.assign(integrationPayload, {
            title: tempIntegrationWrapper.getTitle(),
          });
        }

        const newIntegration = await this.integrationsService.integrationCreate(
          {
            ...context,
            socket_id: null,
          },
          {
            workspaceId: context.workspace_id,
            integration: integrationPayload,
            req,
          },
        );

        const newSyncConfig = await SyncConfig.insert(context, {
          fk_integration_id: newIntegration.id,
          fk_parent_sync_config_id: syncConfig.id,
          created_by: req.user.id,
          updated_by: req.user.id,
        });

        // Store the syncConfigId in the integration for response
        (newIntegration as any).syncConfigId = newSyncConfig.id;
        (newIntegration as any).parentSyncConfigId =
          newSyncConfig.fk_parent_sync_config_id;

        updatedIntegrations.push(newIntegration);
      }
    }

    if (schemaChanged) {
      await this.triggerSync(context, {
        syncConfigId,
        bulk: true,
        fullResync: true,
        req,
      });
    }

    const updatedSyncConfig = await SyncConfig.get(context, syncConfigId);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'app_sync_update',
          payload: { ...updatedSyncConfig, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return {
      syncConfig: updatedSyncConfig,
      integrations: updatedIntegrations,
    };
  }

  @TraceCommand(OperationName.appSyncDelete)
  async deleteSync(
    context: NcContext,
    param: {
      syncConfigId: string;
      req: NcRequest;
      dropTables?: boolean;
      skipTrash?: boolean;
    },
  ) {
    const { syncConfigId, req, dropTables = false, skipTrash = false } = param;

    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.get(context).syncConfigNotFound(syncConfigId);
    }

    // Default: deleting a sync moves it to trash (restorable):
    //  - keep tables → dest tables are detached now (regular, editable
    //    tables) and re-attached if the sync is restored;
    //  - drop tables → dest tables move to trash with the sync as parent
    //    and come back with it on restore.
    if (!skipTrash) {
      await this.baseTrashService.trashResource(
        {
          ...context,
          socket_id: null,
        },
        {
          resourceId: syncConfigId,
          resourceType: 'appSync',
          user: req.user,
          req,
          options: { dropTables },
        },
      );

      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'app_sync_delete',
            payload: { id: syncConfig.id, base_id: context.base_id },
          },
        },
        context.socket_id,
      );

      return true;
    }

    try {
      if (syncConfig.fk_parent_sync_config_id) {
        const parentSyncMapping = await SyncMapping.list(context, {
          fk_sync_config_id: syncConfig.fk_parent_sync_config_id,
          force: true,
        });

        for (const syncMapping of parentSyncMapping) {
          const model = await Model.get(context, syncMapping.fk_model_id);
          if (!model) continue;

          await model.getColumns(context);

          const syncConfigIdColId = model.columns.find(
            (c) => c.title === 'SyncConfigId',
          )?.id;
          if (!syncConfigIdColId) {
            continue;
          }

          await this.bulkDataAliasService.bulkDataDeleteAll(
            { ...context, socket_id: null },
            {
              baseName: model.base_id,
              tableName: model.id,
              req,
              query: {
                internalFlags: { skipHooks: true },
                filterArr: [
                  {
                    comparison_op: 'eq',
                    value: syncConfig.id,
                    logical_op: 'and',
                    fk_column_id: syncConfigIdColId,
                  },
                ],
              },
            },
          );
        }
      } else {
        const syncMappings = await SyncMapping.list(context, {
          fk_sync_config_id: syncConfig.id,
          force: true,
        });

        for (const syncMapping of syncMappings) {
          const table = await Model.get(context, syncMapping.fk_model_id);

          if (table) {
            if (table.mm) {
              await Model.markAsMmTable(context, table.id, false);
            }

            await this.tablesService.tableDelete(
              { ...context, socket_id: null },
              {
                tableId: syncMapping.fk_model_id,
                forceDeleteSyncs: true,
                forceDeleteRelations: true,
                skipTrash: true,
                req,
              },
            );
          }

          await SyncMapping.delete(context, syncMapping.id);
        }
      }

      await SyncConfig.delete(context, syncConfigId);
    } catch (e) {
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error('Failed to delete sync', e);
      NcError.get(context).internalServerError('Failed to delete sync');
    }

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'app_sync_delete',
          payload: { id: syncConfig.id, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return true;
  }

  async integrationFetchOptions(
    context: NcContext,
    param: {
      integration: IntegrationReqType;
      key: string;
    },
  ) {
    const { integration, key } = param;

    const tempIntegrationWrapper =
      Integration.tempIntegrationWrapper<SyncIntegration>(integration);

    const authIntegration = await Integration.get(
      context,
      integration.config.authIntegrationId,
    );

    if (!authIntegration) {
      NcError.genericNotFound(
        'AuthIntegration',
        integration.config.authIntegrationId,
      );
    }

    const authWrapper =
      await authIntegration.getIntegrationWrapper<AuthIntegration>();

    await authWrapper.authenticate();

    const options = await tempIntegrationWrapper.fetchOptions(authWrapper, key);

    if (authWrapper?.destroy) {
      await authWrapper.destroy();
    }

    return options;
  }

  async integrationFetchDestinationSchema(
    context: NcContext,
    param: {
      integration: IntegrationReqType;
    },
  ) {
    const { integration } = param;

    const tempIntegrationWrapper =
      Integration.tempIntegrationWrapper<SyncIntegration>(integration);

    const authIntegration = await Integration.get(
      context,
      integration.config.authIntegrationId,
    );

    if (!authIntegration) {
      NcError.genericNotFound(
        'AuthIntegration',
        integration.config.authIntegrationId,
      );
    }

    const authWrapper =
      await authIntegration.getIntegrationWrapper<AuthIntegration>();

    await authWrapper.authenticate();

    const schema = await tempIntegrationWrapper.getDestinationSchema(
      authWrapper,
    );

    if (authWrapper?.destroy) {
      await authWrapper.destroy();
    }

    return schema;
  }
}
