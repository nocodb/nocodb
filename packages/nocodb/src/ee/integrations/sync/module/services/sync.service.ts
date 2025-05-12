import { Injectable, Logger } from '@nestjs/common';
import {
  IntegrationsType,
  NcApiVersion,
  type NcContext,
  type NcRequest,
  SyncTrigger,
} from 'nocodb-sdk';
import { syncSystemFields } from '@noco-local-integrations/core';
import { RelationTypes } from 'nocodb-sdk';
import type { IntegrationReqType, UITypes } from 'nocodb-sdk';
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
  Workspace,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import { IntegrationsService } from '~/services/integrations.service';
import { TablesService } from '~/services/tables.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { ColumnsService } from '~/services/columns.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobStatus, JobTypes } from '~/interface/Jobs';
import Noco from '~/Noco';
import { getJunctionTableName } from '~/services/columns.service';

@Injectable()
export class SyncModuleService {
  private logger: Logger = new Logger(SyncModuleService.name);

  constructor(
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly integrationsService: IntegrationsService,
    protected readonly tablesService: TablesService,
    protected readonly bulkDataAliasService: BulkDataAliasService,
    protected readonly columnsService: ColumnsService,
  ) {}

  async createSync(
    context: NcContext,
    payload: IntegrationReqType,
    req: NcRequest,
  ) {
    if (payload.type !== IntegrationsType.Sync) {
      NcError.badRequest('Integration is not a sync integration');
    }

    if (
      !payload.config?.authIntegrationId ||
      !payload.config?.sync ||
      !payload.config?.sync.sync_type ||
      !payload.config?.sync.sync_trigger
    ) {
      NcError.badRequest('Invalid sync config');
    }

    const { sync, ...config } = payload.config;

    const integrationPayload = {
      ...payload,
      config,
    };

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

    const integration = await this.integrationsService.integrationCreate(
      context,
      {
        workspaceId,
        integration: integrationPayload,
        req,
      },
    );

    const wrapper = await integration.getIntegrationWrapper<SyncIntegration>();

    const authIntegration = await Integration.get(
      context,
      payload.config.authIntegrationId,
    );

    if (!authIntegration) {
      NcError.genericNotFound(
        'AuthIntegration',
        payload.config.authIntegrationId,
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
      fk_integration_id: integration.id,
      ...(sync || {}),
    });

    const syncMappings: SyncMapping[] = [];
    const schemaKeyTableMap: Map<string, Model> = new Map();
    const tablesToDelete: Model[] = [];
    try {
      for (const [tableKey, tableSchema] of Object.entries(schema)) {
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
        const columns = [...syncSystemFields, ...tableSchema.columns];

        const model = await this.tablesService.tableCreate(context, {
          baseId: base.id,
          table: {
            title: tableTitle,
            columns: columns.map((column) => ({
              title: column.title,
              column_name: column.column_name || column.title,
              uidt: column.uidt as UITypes,
              readonly: true,
              system: column.system,
              pv: column.pv,
            })),
          },
          apiVersion: NcApiVersion.V3,
          synced: true,
          user: req.user,
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

          // create junction table
          const junctionTable = await this.tablesService.tableCreate(context, {
            baseId: base.id,
            user: req.user,
            req,
            apiVersion: NcApiVersion.V3,
            table: {
              title: jnTableTitle,
              columns: [
                {
                  title: 'remote_id_parent',
                  column_name: 'remote_id_parent',
                  uidt: 'SingleLineText',
                },
                {
                  title: 'remote_id_child',
                  column_name: 'remote_id_child',
                  uidt: 'SingleLineText',
                },
              ],
            },
          });

          tablesToDelete.push(junctionTable);

          await Model.setAsMm(context, junctionTable.id);

          await junctionTable.getColumns(context);

          const remoteIdParentColumn = table.columns.find(
            (c) => c.column_name === 'remote_id',
          );

          const remoteIdChildColumn = relatedTable.columns.find(
            (c) => c.column_name === 'remote_id',
          );

          const parentColumn = junctionTable.columns.find(
            (c) => c.title === 'remote_id_parent',
          );

          const childColumn = junctionTable.columns.find(
            (c) => c.title === 'remote_id_child',
          );

          const column = await this.columnsService.columnAdd(context, {
            tableId: table.id,
            column: {
              title: relation.columnTitle,
              column_name: relation.columnTitle
                .replace(/\W/g, '_')
                .toLowerCase(),
              uidt: 'Links',
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

          /*
          {
            "custom": {
              "base_id": "p4h33hk6s37dj7c",
              "column_id": "c6fyao8adpmq5gi",
              "junc_base_id": "p4h33hk6s37dj7c",
              "junc_model_id": "mm9nt233xq54rts",
              "junc_column_id": "cng73k9wz5ezbay",
              "junc_ref_column_id": "clhfa7h2c1sxp81",
              "ref_model_id": "m28yk5mytny1odl",
              "ref_column_id": "ck7kx67z2dvtr94"
            },
            "title": "title29",
            "column_name": "title29",
            "uidt": "Links",
            "userHasChangedTitle": false,
            "meta": {},
            "rqd": false,
            "pk": false,
            "ai": false,
            "cdf": null,
            "un": false,
            "dtx": "specificType",
            "dt": "character varying",
            "altered": 2,
            "parentId": "mz3b5h80olt32uh",
            "childColumn": "Ticket_id",
            "childTable": "Ticket",
            "parentTable": "",
            "parentColumn": "",
            "type": "mm",
            "onUpdate": "NO ACTION",
            "onDelete": "NO ACTION",
            "virtual": true,
            "alias": "",
            "childId": null,
            "childViewId": null,
            "is_custom_link": true,
            "primaryKey": false,
            "table_name": "Ticket",
            "view_id": "vw06wg99crktc5vl"
          }
          */

          // rename the column of the related table
          await relatedTable.getColumns(context);

          const relatedTableColumn = relatedTable.columns.find(
            (c) =>
              c.colOptions?.fk_mm_model_id === column.colOptions.fk_mm_model_id,
          );

          if (relatedTableColumn) {
            console.log(
              `Changing column title of ${relatedTableColumn.title} to ${relation.relatedTableColumnTitle}`,
            );
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
        await this.tablesService.tableDelete(context, {
          tableId: table.id,
          forceDeleteSyncs: true,
          forceDeleteRelations: true,
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

    const job = await this.triggerSync(context, syncConfig.id, req);

    return {
      integration,
      syncConfig,
      job: {
        id: job.id,
      },
    };
  }

  async triggerSync(context: NcContext, syncConfigId: string, req: NcRequest) {
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

  async listSync(context: NcContext, _req: NcRequest) {
    const syncConfigs = await SyncConfig.list(context);

    return syncConfigs;
  }

  async updateSync(
    context: NcContext,
    syncConfigId: string,
    payload: any,
    req: NcRequest,
  ) {
    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    const { sync, ...config } = payload.config;

    const integrationPayload = {
      ...payload,
      config,
    };

    await this.integrationsService.integrationUpdate(context, {
      integrationId: syncConfig.fk_integration_id,
      integration: integrationPayload,
      req,
    });

    await SyncConfig.update(context, syncConfigId, sync);

    return syncConfig;
  }

  async deleteSync(context: NcContext, syncConfigId: string, req: NcRequest) {
    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      const syncMappings = await SyncMapping.list(context, {
        fk_sync_config_id: syncConfig.id,
      });

      for (const syncMapping of syncMappings) {
        const table = await Model.get(context, syncMapping.fk_model_id);

        if (table) {
          await this.tablesService.tableDelete(context, {
            tableId: syncMapping.fk_model_id,
            forceDeleteSyncs: true,
            forceDeleteRelations: true,
            user: req.user,
            req,
          });
        }

        await SyncMapping.delete(context, syncMapping.id, ncMeta);
      }

      await SyncConfig.delete(context, syncConfigId, ncMeta);

      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      throw e;
    }

    return syncConfig;
  }
}
