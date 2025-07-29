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
  CustomSyncSchema,
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

          const model = await this.tablesService.tableCreate(context, {
            baseId: base.id,
            table: {
              title: tableTitle,
              columns: columns
                .filter((column) => !column.exclude)
                .map((column) => ({
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

        throw e;
      }

      if (authWrapper?.destroy) {
        await authWrapper.destroy();
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
      const integration = await Integration.get(context, integrationPayload.id);

      if (!integration) {
        NcError.genericNotFound('Integration', integrationPayload.id);
      }

      if (integrationPayload && integrationPayload.config?.custom_schema) {
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
          (newTableKey) => !Object.keys(oldCustomSchema).includes(newTableKey),
        );

        const tablesToDrop = Object.keys(oldCustomSchema).filter(
          (oldTableKey) => !Object.keys(newCustomSchema).includes(oldTableKey),
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

          const model = await this.tablesService.tableCreate(context, {
            baseId: context.base_id,
            table: {
              title: table.title,
              columns: columns
                .filter((column) => !column.exclude)
                .map((column) => ({
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

          const defaultView = await View.getDefaultView(context, model.id);

          await this.viewColumnsService.columnsUpdate(context, {
            viewId: defaultView.id,
            columns: model.columns
              .filter((column) => !!syncSystemFieldsMap[column.title])
              .map((column) => ({
                id: column.id,
                show: false,
              })),
            req,
          });

          const syncMapping = await SyncMapping.insert(context, {
            fk_sync_config_id: syncConfig.id,
            target_table: tableKey,
            fk_model_id: model.id,
          });

          syncMappings.push(syncMapping);
        }

        for (const tableKey of tablesToDrop) {
          const mapping = syncMappings.find(
            (m) => m.target_table === oldCustomSchema[tableKey].title,
          );

          if (!mapping) {
            continue;
          }

          const model = await Model.get(context, mapping.fk_model_id);

          if (model) {
            await this.tablesService.tableDelete(context, {
              tableId: model.id,
              forceDeleteSyncs: true,
              user: req.user,
              req,
            });
          }

          await SyncMapping.delete(context, mapping.id);
        }

        for (const tableKey of tablesToModify) {
          const mapping = syncMappings.find(
            (m) => m.target_table === oldCustomSchema[tableKey].title,
          );

          if (!mapping) {
            continue;
          }

          const model = await Model.get(context, mapping.fk_model_id);
          if (model) {
            const table = newCustomSchema[tableKey];

            const existingSyncColumns = (
              await model.getColumns(context)
            ).filter((col) => col.readonly && !syncSystemFieldsMap[col.title]);

            for (const column of table.columns) {
              const existingColumn = existingSyncColumns.find(
                (col) => col.title === column.title,
              );

              if (existingColumn) {
                if (existingColumn.uidt === column.uidt) continue; // no change needed

                await this.columnsService.columnUpdate(context, {
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
                });
              } else {
                if (column.exclude) continue;

                await this.columnsService.columnAdd(context, {
                  tableId: model.id,
                  column: {
                    title: column.title,
                    column_name: column.column_name || column.title,
                    uidt: column.uidt,
                    readonly: true,
                  },
                  user: req.user,
                  req,
                });
              }
            }

            for (const existingColumn of existingSyncColumns) {
              const column = table.columns.find(
                (col) => col.title === existingColumn.title,
              );

              if (!column || column.exclude) {
                await this.columnsService.columnDelete(context, {
                  columnId: existingColumn.id,
                  forceDeleteSystem: true,
                  user: req.user,
                  req,
                });
              }
            }
          }
        }

        await this.nocoJobsService.add(JobTypes.SyncModuleRefreshData, {
          context,
          syncConfigId: syncConfig.id,
          req: {
            user: req.user,
            clientIp: req.clientIp,
          },
        });
      }

      const integrationWrapper =
        await integration.getIntegrationWrapper<SyncIntegration>();

      const tempIntegrationWrapper = Integration.tempIntegrationWrapper(
        integrationPayload,
      ) as SyncIntegration;

      Object.assign(integrationPayload, {
        title: tempIntegrationWrapper.getTitle(),
      });

      const oldNamespaces = await integrationWrapper.getNamespaces();

      const newNamespaces = await tempIntegrationWrapper.getNamespaces();

      const namespacesToDelete = oldNamespaces.filter(
        (namespace) => !newNamespaces.includes(namespace),
      );

      updatedIntegration = await this.integrationsService.integrationUpdate(
        context,
        {
          integrationId: syncConfig.fk_integration_id,
          integration: integrationPayload,
          req,
        },
      );

      // delete the data for the missing namespaces
      if (namespacesToDelete.length > 0) {
        const syncMappings = await SyncMapping.list(context, {
          fk_sync_config_id:
            syncConfig.fk_parent_sync_config_id || syncConfig.id,
          force: true,
        });

        for (const syncMapping of syncMappings) {
          const model = await Model.get(context, syncMapping.fk_model_id);

          if (!model) {
            continue;
          }

          await model.getColumns(context);

          await this.bulkDataAliasService.bulkDataDeleteAll(context, {
            baseName: model.base_id,
            tableName: model.id,
            req,
            query: {
              internalFlags: {
                skipHooks: true,
              },
              filterArr: [
                {
                  comparison_op: 'in',
                  value: namespacesToDelete,
                  logical_op: 'and',
                  fk_column_id: model.columns.find(
                    (c) => c.title === 'RemoteNamespace',
                  )?.id,
                },
              ],
            },
          });
        }
      }
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
      if (syncConfig.fk_parent_sync_config_id) {
        const parentSyncMapping = await SyncMapping.list(context, {
          fk_sync_config_id: syncConfig.fk_parent_sync_config_id,
          force: true,
        });

        // if this is a child sync clear the data for this
        for (const syncMapping of parentSyncMapping) {
          const model = await Model.get(context, syncMapping.fk_model_id);

          if (!model) {
            continue;
          }

          await model.getColumns(context);

          await this.bulkDataAliasService.bulkDataDeleteAll(context, {
            baseName: model.base_id,
            tableName: model.id,
            req,
            query: {
              internalFlags: {
                skipHooks: true,
              },
              filterArr: [
                {
                  comparison_op: 'eq',
                  value: syncConfig.id,
                  logical_op: 'and',
                  fk_column_id: model.columns.find(
                    (c) => c.title === 'SyncConfigId',
                  )?.id,
                },
              ],
            },
          });
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
      }

      await SyncConfig.delete(context, syncConfigId);
    } catch (e) {
      throw e;
    }

    return syncConfig;
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

    const auth = await authWrapper.authenticate();

    const options = await tempIntegrationWrapper.fetchOptions(auth, key);

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

    const auth = await authWrapper.authenticate();

    const schema = await tempIntegrationWrapper.getDestinationSchema(auth);

    if (authWrapper?.destroy) {
      await authWrapper.destroy();
    }

    return schema;
  }
}
