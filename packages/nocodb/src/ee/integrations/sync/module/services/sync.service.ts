import { Injectable, Logger } from '@nestjs/common';
import {
  IntegrationsType,
  NcApiVersion,
  type NcContext,
  type NcRequest,
  SyncTrigger,
} from 'nocodb-sdk';
import { syncSystemFields } from '@noco-local-integrations/core';
import type { IntegrationReqType, UITypes } from 'nocodb-sdk';
import type {
  AuthIntegration,
  SyncIntegration,
  SyncSchema,
} from '@noco-local-integrations/core';
import { Base, Integration, Model, SyncConfig, Workspace } from '~/models';
import { NcError } from '~/helpers/catchError';
import { IntegrationsService } from '~/services/integrations.service';
import { TablesService } from '~/services/tables.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobStatus, JobTypes } from '~/interface/Jobs';

type SystemSyncSchema = (SyncSchema[number] & {
  system?: boolean;
})[];

@Injectable()
export class SyncModuleService {
  private logger: Logger = new Logger(SyncModuleService.name);

  constructor(
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly integrationsService: IntegrationsService,
    protected readonly tablesService: TablesService,
    protected readonly bulkDataAliasService: BulkDataAliasService,
  ) {}

  async createSyncTable(
    context: NcContext,
    payload: IntegrationReqType & {
      table_name: string;
    },
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

    const titleAvailable = await Model.checkTitleAvailable(context, {
      table_name: payload.table_name,
      base_id: base.id,
      source_id: source.id,
    });

    if (!titleAvailable) {
      NcError.badRequest('A table with this name already exists');
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

    const auth = await authWrapper.authenticate(authIntegration.getConfig());

    const schema = (await wrapper.getDestinationSchema(
      auth,
      payload.config,
    )) as SystemSyncSchema;

    schema.unshift(...syncSystemFields);

    const model = await this.tablesService.tableCreate(context, {
      baseId: base.id,
      table: {
        title: payload.table_name,
        columns: schema.map((column) => ({
          title: column.title,
          column_name: column.column_name || column.title,
          uidt: column.uidt as UITypes,
          system: column.system,
          pv: column.pv,
          readonly: true,
        })),
      },
      apiVersion: NcApiVersion.V3,
      synced: true,
      user: req.user,
      req,
    });

    const syncConfig = await SyncConfig.insert(context, {
      fk_integration_id: integration.id,
      fk_model_id: model.id,
      ...(sync ? sync : {}),
    });

    // queue initial sync
    const job = await this.triggerSync(context, syncConfig.id, req);

    return {
      integration,
      table: model,
      syncConfig,
      job: {
        id: job.id,
      },
    };
  }

  async createSync(
    context: NcContext,
    payload: IntegrationReqType & {
      fk_model_id: string;
    },
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

    const model = await Model.get(context, payload.fk_model_id);

    if (!model) {
      NcError.tableNotFound(payload.fk_model_id);
    }

    if (!model.synced) {
      NcError.badRequest('Table is not synced');
    }

    const integration = await this.integrationsService.integrationCreate(
      context,
      {
        workspaceId,
        integration: integrationPayload,
        req,
      },
    );

    const syncConfig = await SyncConfig.insert(context, {
      fk_integration_id: integration.id,
      fk_model_id: model.id,
      ...(sync ? sync : {}),
    });

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

  async listSync(context: NcContext, fk_model_id: string, _req: NcRequest) {
    const syncConfigs = await SyncConfig.list(context, { fk_model_id });

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

    await SyncConfig.delete(context, syncConfigId);

    return syncConfig;
  }
}
