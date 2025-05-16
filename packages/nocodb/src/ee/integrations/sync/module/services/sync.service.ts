import { Injectable, Logger } from '@nestjs/common';
import {
  type IntegrationReqType,
  IntegrationsType,
  NcApiVersion,
  type NcContext,
  type NcRequest,
  RelationTypes,
  SyncTrigger,
  TARGET_TABLES_META,
  UITypes,
} from 'nocodb-sdk';
import {
  syncSystemFields,
  syncSystemFieldsMap,
} from '@noco-local-integrations/core';
import type { OnDeleteAction, SyncCategory, SyncType } from 'nocodb-sdk';
import type {
  AuthIntegration,
  SyncIntegration,
} from '@noco-local-integrations/core';
import {
  Base,
  Integration,
  Model,
  SyncConfig,
  SyncMapping,
  View,
  Workspace,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import { IntegrationsService } from '~/services/integrations.service';
import { TablesService } from '~/services/tables.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { ColumnsService } from '~/services/columns.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobStatus, JobTypes } from '~/interface/Jobs';
import { getJunctionTableName } from '~/services/columns.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { getMMColumnNames } from '~/helpers/columnHelpers';

@Injectable()
export class SyncModuleService {
  private logger: Logger = new Logger(SyncModuleService.name);

  constructor(
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly integrationsService: IntegrationsService,
    protected readonly tablesService: TablesService,
    protected readonly bulkDataAliasService: BulkDataAliasService,
    protected readonly columnsService: ColumnsService,
    protected readonly viewColumnsService: ViewColumnsService,
  ) {}

  async createSync(
    context: NcContext,
    payload: {
      title: string;
      sync_type: SyncType;
      sync_trigger: SyncTrigger;
      sync_trigger_cron: string;
      on_delete_action: OnDeleteAction;
      sync_category: SyncCategory;
      exclude_models: string[];
      configs: IntegrationReqType[];
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
      exclude_models,
      configs,
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

      Object.assign(mainConfig, {
        title: tempIntegrationWrapper.getTitle(),
      });

      const mainIntegration = await this.integrationsService.integrationCreate(
        context,
        {
          workspaceId,
          integration: mainConfig,
          req,
        },
      );

      integrationsToDelete.push(mainIntegration);

      const wrapper =
        await mainIntegration.getIntegrationWrapper<SyncIntegration>();

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

      const auth = await authWrapper.authenticate();

      const schema = await wrapper.getDestinationSchema(auth);

      if (!schema || Object.keys(schema).length === 0) {
        NcError.badRequest('No tables found in the schema');
      }

      const syncConfig = await SyncConfig.insert(context, {
        fk_integration_id: mainIntegration.id,
        title,
        sync_type,
        sync_trigger,
        sync_trigger_cron,
        sync_category,
        on_delete_action,
      });

      syncConfigsToDelete.push(syncConfig);

      for (const childConfig of configs) {
        const tempIntegrationWrapper = Integration.tempIntegrationWrapper(
          childConfig,
        ) as SyncIntegration;

        Object.assign(childConfig, {
          title: tempIntegrationWrapper.getTitle(),
        });

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
        });

        syncConfigsToDelete.push(childSyncConfig);
      }

      const syncMappings: SyncMapping[] = [];
      const schemaKeyTableMap: Map<string, Model> = new Map();
      const tablesToDelete: Model[] = [];
      try {
        for (const [tableKey, tableSchema] of Object.entries(schema)) {
          const tableMeta = TARGET_TABLES_META[tableKey];

          if (exclude_models.includes(tableKey) && !tableMeta.required) {
            continue;
          }

          const tableTitle = tableSchema.title;

          // Check if table name is available
          const titleAvailable = await Model.checkTitleAvailable(context, {
            table_name: tableTitle,
            base_id: base.id,
            source_id: source.id,
          });

          if (!titleAvailable) {
            this.logger.warn(`Table "${tableTitle}" already exists, skipping`);
            continue;
          }

          // Add system fields to the columns
          const columns = [...tableSchema.columns, ...syncSystemFields];

          const model = await this.tablesService.tableCreate(context, {
            baseId: base.id,
            table: {
              title: tableTitle,
              columns: columns.map((column) => ({
                title: column.title,
                column_name: column.column_name || column.title,
                uidt: column.uidt as UITypes,
                readonly: true,
                pv: column.pv,
                meta: column.meta,
              })),
            },
            apiVersion: NcApiVersion.V3,
            synced: true,
            user: req.user,
            req,
          });

          // Hide syncSystemFields from default view
          const defaultView = await View.getDefaultView(context, model.id);

          await this.viewColumnsService.columnsUpdate(context, {
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
          });

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
              context,
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
                    ...syncSystemFields,
                  ],
                },
                synced: true,
              },
            );

            await SyncMapping.insert(context, {
              fk_sync_config_id: syncConfig.id,
              target_table: null,
              fk_model_id: junctionTable.id,
            });

            tablesToDelete.push(junctionTable);

            await Model.markAsMmTable(context, junctionTable.id, true);

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

            const column = await this.columnsService.columnAdd(context, {
              tableId: table.id,
              column: {
                title: relation.columnTitle,
                column_name: relation.columnTitle
                  .replace(/\W/g, '_')
                  .toLowerCase(),
                uidt: UITypes.LinkToAnotherRecord,
                type: RelationTypes.MANY_TO_MANY,
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
              },
              user: req.user,
              req,
              apiVersion: NcApiVersion.V3,
            });

            // rename the column of the related table
            await relatedTable.getColumns(context);

            const relatedTableColumn = relatedTable.columns.find(
              (c) =>
                c.colOptions?.fk_mm_model_id ===
                column.colOptions.fk_mm_model_id,
            );

            if (relatedTableColumn) {
              await this.columnsService.columnUpdate(context, {
                columnId: relatedTableColumn.id,
                column: {
                  ...relatedTableColumn,
                  title: relation.relatedTableColumnTitle,
                },
                user: req.user,
                req,
                apiVersion: NcApiVersion.V3,
              });
            }
          }
        }
      } catch (e) {
        for (const table of tablesToDelete) {
          if (table.mm) {
            await Model.markAsMmTable(context, table.id, false);
          }

          await this.tablesService.tableDelete(context, {
            tableId: table.id,
            forceDeleteSyncs: true,
            user: req.user,
            req,
          });
        }

        for (const syncMapping of syncMappings) {
          await SyncMapping.delete(context, syncMapping.id);
        }

        await SyncConfig.delete(context, syncConfig.id);

        throw e;
      }

      const job = await this.triggerSync(context, syncConfig.id, true, req);

      return {
        integration: mainIntegration,
        syncConfig,
        job: {
          id: job.id,
        },
      };
    } catch (e) {
      for (const integration of integrationsToDelete) {
        await this.integrationsService.integrationDelete(context, {
          integrationId: integration.id,
          req,
          force: false,
        });
      }

      for (const syncConfig of syncConfigsToDelete) {
        await SyncConfig.delete(context, syncConfig.id);
      }

      throw e;
    }
  }

  async triggerSync(
    context: NcContext,
    syncConfigId: string,
    bulk?: boolean,
    req?: NcRequest,
  ) {
    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    if (syncConfig.sync_job_id) {
      const job = await this.nocoJobsService.getJob(syncConfig.sync_job_id);

      if (job) {
        const status = await job.getState();

        if (
          ![JobStatus.COMPLETED, JobStatus.FAILED].includes(status as JobStatus)
        ) {
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
      trigger: SyncTrigger.Manual,
      bulk,
      req: {
        user: req.user,
        clientIp: req.clientIp,
      },
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
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    const job = await this.nocoJobsService.add(JobTypes.SyncModuleMigrateSync, {
      context,
      syncConfigId: syncConfig.id,
      req: {
        user: req.user,
        clientIp: req.clientIp,
      },
    });

    return {
      id: job.id,
    };
  }

  async listSync(context: NcContext, _req: NcRequest) {
    const syncConfigs = await SyncConfig.list(context);

    return syncConfigs;
  }

  async readSync(context: NcContext, syncConfigId: string) {
    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    return syncConfig;
  }

  async updateSync(
    context: NcContext,
    syncConfigId: string,
    payload: {
      title: string;
      sync_type: SyncType;
      sync_trigger: SyncTrigger;
      sync_trigger_cron: string;
      on_delete_action: OnDeleteAction;
      config: IntegrationReqType & { id?: string };
    },
    req: NcRequest,
  ) {
    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    const integrationPayload = payload.config;

    let updatedIntegration: Integration | null = null;
    let updatedSyncConfig: SyncConfig | null = null;

    if (integrationPayload && integrationPayload.id) {
      const tempIntegrationWrapper = Integration.tempIntegrationWrapper(
        integrationPayload,
      ) as SyncIntegration;

      Object.assign(integrationPayload, {
        title: tempIntegrationWrapper.getTitle(),
      });

      updatedIntegration = await this.integrationsService.integrationUpdate(
        context,
        {
          integrationId: syncConfig.fk_integration_id,
          integration: integrationPayload,
          req,
        },
      );
    } else if (
      integrationPayload &&
      integrationPayload.type === IntegrationsType.Sync
    ) {
      const tempIntegrationWrapper = Integration.tempIntegrationWrapper(
        integrationPayload,
      ) as SyncIntegration;

      Object.assign(integrationPayload, {
        title: tempIntegrationWrapper.getTitle(),
      });

      updatedIntegration = await this.integrationsService.integrationCreate(
        context,
        {
          workspaceId: context.workspace_id,
          integration: integrationPayload,
          req,
        },
      );

      updatedSyncConfig = await SyncConfig.insert(context, {
        fk_integration_id: updatedIntegration.id,
        fk_parent_sync_config_id: syncConfig.id,
      });
    } else if (!syncConfig.fk_parent_sync_config_id) {
      updatedSyncConfig = await SyncConfig.update(context, syncConfigId, {
        title: payload.title,
        sync_type: payload.sync_type,
        sync_trigger: payload.sync_trigger,
        sync_trigger_cron: payload.sync_trigger_cron,
        on_delete_action: payload.on_delete_action,
      });
    }

    return {
      syncConfig: updatedSyncConfig ?? syncConfig,
      integration: updatedIntegration,
    };
  }

  async deleteSync(context: NcContext, syncConfigId: string, req: NcRequest) {
    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    // TODO: transaction
    try {
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

          await this.tablesService.tableDelete(context, {
            tableId: syncMapping.fk_model_id,
            forceDeleteSyncs: true,
            forceDeleteRelations: true,
            user: req.user,
            req,
          });
        }

        await SyncMapping.delete(context, syncMapping.id);
      }

      await SyncConfig.delete(context, syncConfigId);
    } catch (e) {
      throw e;
    }

    return syncConfig;
  }
}
