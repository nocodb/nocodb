import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { InternalController as InternalControllerCE } from 'src/controllers/internal.controller';
import { DataReflectionService } from '~/services/data-reflection.service';
import { DashboardsService } from '~/services/dashboards.service';
import { RemoteImportService } from '~/modules/jobs/jobs/export-import/remote-import.service';
import { SyncModuleService } from '~/integrations/sync/module/services/sync.service';
import { McpTokenService } from '~/services/mcp.service';
import {
  Acl,
  AclMiddleware,
} from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { ScriptsService } from '~/services/scripts.service';
import { getBaseSchema } from '~/helpers/scriptHelper';
import { NcError } from '~/helpers/catchError';
import { IntegrationsService } from '~/services/integrations.service';
import {
  InternalGETResponseType,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { ColumnsService } from '~/services/columns.service';
import { AuditsService } from '~/services/audits.service';
import { PermissionsService } from '~/services/permissions.service';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';

@Controller()
export class InternalController extends InternalControllerCE {
  constructor(
    protected readonly mcpService: McpTokenService,
    protected readonly aclMiddleware: AclMiddleware,
    protected readonly auditsService: AuditsService,
    private readonly dataReflectionService: DataReflectionService,
    private readonly remoteImportService: RemoteImportService,
    private readonly syncService: SyncModuleService,
    private readonly scriptsService: ScriptsService,
    private readonly columnsService: ColumnsService,
    private readonly integrationsService: IntegrationsService,
    private readonly permissionsService: PermissionsService,
    protected readonly dashboardsService: DashboardsService,
  ) {
    super(mcpService, aclMiddleware, auditsService);
  }

  protected async checkAcl(operation: string, req, scope?: string) {
    await this.aclMiddleware.aclFn(
      operation,
      {
        scope,
      },
      null,
      req,
    );
  }

  protected get operationScopes() {
    return {
      ...super.operationScopes,
      createDataReflection: 'workspace',
      getDataReflection: 'workspace',
      deleteDataReflection: 'workspace',
      listenRemoteImport: 'workspace',
      createSync: 'base',
      triggerSync: 'base',
      migrateSync: 'base',
      addChildSync: 'base',
      authIntegrationTestConnection: 'workspace',
      syncIntegrationFetchOptions: 'workspace',
      listScripts: 'base',
      getScript: 'base',
      createScript: 'base',
      updateScript: 'base',
      deleteScript: 'base',
      baseSchema: 'base',
      workspaceAuditList: 'workspace',
      duplicateScript: 'base',
      setPermission: 'base',
      dropPermission: 'base',
      bulkDropPermissions: 'base',

      dashboardList: 'base',
      dashboardGet: 'base',
      dashboardCreate: 'base',
      dashboardUpdate: 'base',
      dashboardDelete: 'base',
      widgetList: 'base',
      widgetGet: 'base',
      widgetCreate: 'base',
      widgetUpdate: 'base',
      widgetDelete: 'base',
      widgetDuplicate: 'base',
      widgetDataGet: 'base',
      dashboardShare: 'base',
    };
  }

  @Get(['/api/v2/internal/:workspaceId/:baseId'])
  protected async internalAPI(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Query('operation') operation: string,
    @Req() req: NcRequest,
  ): InternalGETResponseType {
    await this.checkAcl(operation, req, this.operationScopes[operation]);

    switch (operation) {
      case 'getDataReflection':
        return await this.dataReflectionService.get(workspaceId);
      case 'listSync':
        return await this.syncService.listSync(context, req);
      case 'readSync':
        return await this.syncService.readSync(context, req.query.id);
      case 'listScripts':
        return await this.scriptsService.listScripts(context, baseId);
      case 'getScript':
        return await this.scriptsService.getScript(context, req.query.id);
      case 'baseSchema':
        return await getBaseSchema(context);
      case 'mcpList':
        return await this.mcpService.list(context, req);
      case 'mcpGet':
        return await this.mcpService.get(context, req.query.tokenId as string);
      case 'workspaceAuditList': {
        const { limit } = await getLimit(
          PlanLimitTypes.LIMIT_AUDIT_RETENTION,
          context.workspace_id,
        );

        return await this.auditsService.workspaceAuditList(context, {
          cursor: req.query.cursor,
          baseId: req.query.baseId,
          fkUserId: req.query.fkUserId,
          type: req.query.type,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          orderBy: req.query.orderBy,
          retentionLimit: limit,
        });
      }
      case 'recordAuditList': {
        const { limit } = await getLimit(
          PlanLimitTypes.LIMIT_AUDIT_RETENTION,
          context.workspace_id,
        );

        return await this.auditsService.recordAuditList(context, {
          row_id: req.query.row_id as string,
          fk_model_id: req.query.fk_model_id as string,
          cursor: req.query.cursor as string,
          retentionLimit: limit,
        });
      }
      case 'dashboardList':
        return await this.dashboardsService.dashboardList(context, baseId);
      case 'dashboardGet':
        return await this.dashboardsService.dashboardGet(
          context,
          req.query.dashboardId as string,
        );
      case 'widgetList':
        return await this.dashboardsService.widgetList(
          context,
          req.query.dashboardId as string,
        );
      case 'widgetGet':
        return await this.dashboardsService.widgetGet(
          context,
          req.query.widgetId as string,
        );
      case 'widgetDataGet':
        return await this.dashboardsService.widgetDataGet(
          context,
          req.query.widgetId as string,
          req,
        );
      default:
        return await super.internalAPI(
          context,
          workspaceId,
          baseId,
          operation,
          req,
        );
    }
  }

  @Post(['/api/v2/internal/:workspaceId/:baseId'])
  protected async internalAPIPost(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Query('operation') operation: string,
    @Body() payload: any,
    @Req() req: NcRequest,
  ): InternalPOSTResponseType {
    await this.checkAcl(operation, req, this.operationScopes[operation]);

    switch (operation) {
      case 'createDataReflection':
        return await this.dataReflectionService.create(workspaceId);
      case 'deleteDataReflection':
        return await this.dataReflectionService.delete(workspaceId);

      case 'listenRemoteImport':
        return await this.remoteImportService.remoteImport(
          context,
          workspaceId,
          payload,
          req,
        );

      case 'abortRemoteImport':
        return await this.remoteImportService.abortRemoteImport(
          context,
          payload.secret,
          req,
        );

      case 'createSync':
        return await this.syncService.createSync(context, payload, req);
      case 'triggerSync':
        if (!payload.syncConfigId) {
          NcError.genericNotFound('SyncConfig', payload.syncConfigId);
        }

        return await this.syncService.triggerSync(
          context,
          payload.syncConfigId,
          payload.bulk,
          req,
        );
      case 'updateSync':
        return await this.syncService.updateSync(
          context,
          payload.syncConfigId,
          payload,
          req,
        );
      case 'deleteSync':
        if (!payload.syncConfigId) {
          NcError.genericNotFound('SyncConfig', payload.syncConfigId);
        }
        return await this.syncService.deleteSync(
          context,
          payload.syncConfigId,
          req,
        );
      case 'migrateSync':
        if (!payload.syncConfigId) {
          NcError.genericNotFound('SyncConfig', payload.syncConfigId);
        }

        return await this.syncService.migrateSync(
          context,
          payload.syncConfigId,
          req,
        );
      case 'syncIntegrationFetchOptions':
        return await this.syncService.integrationFetchOptions(context, {
          integration: payload.integration,
          key: payload.key,
        });
      case 'syncIntegrationFetchDestinationSchema':
        return (await this.syncService.integrationFetchDestinationSchema(
          context,
          {
            integration: payload.integration,
          },
        )) as any;
      case 'authIntegrationTestConnection':
        return await this.integrationsService.authIntegrationTestConnection(
          payload,
        );

      case 'createScript':
        return await this.scriptsService.createScript(
          context,
          baseId,
          payload,
          req,
        );

      case 'updateScript':
        return await this.scriptsService.updateScript(
          context,
          payload.id,
          payload,
          req,
        );

      case 'deleteScript':
        return await this.scriptsService.deleteScript(context, payload.id, req);

      case 'duplicateScript':
        return await this.scriptsService.duplicateScript(
          context,
          payload.id,
          req,
        );

      case 'setPermission':
        return await this.permissionsService.setPermission(
          context,
          payload,
          req,
        );

      case 'dropPermission':
        return await this.permissionsService.dropPermission(context, payload);

      case 'bulkDropPermissions':
        return await this.permissionsService.bulkDropPermissions(
          context,
          payload,
        );

      case 'dashboardCreate':
        return await this.dashboardsService.dashboardCreate(
          context,
          payload,
          req,
        );
      case 'dashboardUpdate':
        return await this.dashboardsService.dashboardUpdate(
          context,
          payload.dashboardId,
          payload,
          req,
        );
      case 'dashboardDelete':
        return await this.dashboardsService.dashboardDelete(
          context,
          payload.dashboardId,
          req,
        );
      case 'widgetCreate':
        return await this.dashboardsService.widgetCreate(context, payload, req);
      case 'widgetDuplicate':
        return await this.dashboardsService.duplicateWidget(
          context,
          payload.widgetId,
          req,
        );
      case 'widgetUpdate':
        return await this.dashboardsService.widgetUpdate(
          context,
          payload.widgetId,
          payload,
          req,
        );
      case 'widgetDelete':
        return await this.dashboardsService.widgetDelete(
          context,
          payload.widgetId,
          req,
        );

      case 'widgetDataGet':
        return await this.dashboardsService.widgetDataGet(
          context,
          payload.widgetId,
          req,
        );

      case 'dashboardShare':
        return await this.dashboardsService.dashboardShare(
          context,
          payload,
          req,
        );
      default:
        return await super.internalAPIPost(
          context,
          workspaceId,
          baseId,
          operation,
          payload,
          req,
        );
    }
  }

  @Get(['/api/v1/db/internal/links/:columnId/tables/:refTableId'])
  @Acl('tableGet')
  async tableGet(
    @TenantContext() context: NcContext,
    @Param('columnId') columnId: string,
    @Param('refTableId') refTableId: string,
  ) {
    return await this.columnsService.getLinkColumnRefTable(context, {
      columnId,
      tableId: refTableId,
    });
  }
}
