import { Injectable, Logger } from '@nestjs/common';
import {
  IntegrationsType,
  NcApiVersion,
  type NcContext,
  type NcRequest,
  RelationTypes,
  SyncTrigger,
} from 'nocodb-sdk';
import { syncSystemFields } from '@noco-local-integrations/core';
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
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobStatus, JobTypes } from '~/interface/Jobs';
import Noco from '~/Noco';

@Injectable()
export class SyncModuleService {
  private logger: Logger = new Logger(SyncModuleService.name);

  constructor(
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly integrationsService: IntegrationsService,
    protected readonly tablesService: TablesService,
    protected readonly bulkDataAliasService: BulkDataAliasService,
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

    const tablesCreated: Model[] = [];
    const syncMappings: SyncMapping[] = [];
    const tableIdSchemaKeyMap: Map<string, string> = new Map();

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

        tablesCreated.push(model);

        tableIdSchemaKeyMap.set(model.id, tableKey);

        const syncMapping = await SyncMapping.insert(context, {
          fk_sync_config_id: syncConfig.id,
          target_table: tableKey,
          fk_model_id: model.id,
        });

        syncMappings.push(syncMapping);
      }

      // create relations between tables
      for (const table of tablesCreated) {
        const tableKey = tableIdSchemaKeyMap.get(table.id);

        if (!tableKey) {
          continue;
        }

        const tableSchema = schema[tableKey as keyof typeof schema];

        for (const relation of tableSchema.relations) {
          switch (relation.type) {
            case RelationTypes.HAS_MANY:
              break;
            case RelationTypes.MANY_TO_MANY:
              break;
            case RelationTypes.ONE_TO_ONE:
              break;
          }
        }
      }
    } catch (e) {
      for (const table of tablesCreated) {
        await table.delete(context);
      }

      for (const syncMapping of syncMappings) {
        await SyncMapping.delete(context, syncMapping.id);
      }

      await SyncConfig.delete(context, syncConfig.id);

      throw e;
    }

    // const job = await this.triggerSync(context, syncConfig.id, req);

    return {
      integration,
      syncConfig,
      /*job: {
        id: job.id,
      },*/
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

  async deleteSync(context: NcContext, syncConfigId: string, _req: NcRequest) {
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
