import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { InternalController as InternalControllerCE } from 'src/controllers/internal.controller';
import { isServiceUser, ServiceUserType } from 'nocodb-sdk';
import type { InternalApiModule } from '~/utils/internal-type';
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
import { ActionsService } from '~/services/actions.service';
import { MailService } from '~/services/mail/mail.service';
import { ViewSettingsOverrideService } from '~/services/view-settings-override.service';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';
import { TeamsV3Service } from '~/services/v3/teams-v3.service';
import { UsersService } from '~/services/users/users.service';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';
import { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import { WorkspaceTeamsV3Service } from '~/services/v3/workspace-teams-v3.service';
import { BaseTeamsV3Service } from '~/services/v3/base-teams-v3.service';
import { UtilsService } from '~/services/utils.service';
import { WorkflowsService } from '~/ee/services/workflows.service';
import { WorkflowExecutionService } from '~/services/workflow-execution.service';

@Controller()
export class InternalController extends InternalControllerCE {
  constructor(
    protected readonly aclMiddleware: AclMiddleware,
    @Inject(INTERNAL_API_MODULE_PROVIDER_KEY)
    protected readonly internalApiModules: InternalApiModule<any>[],
    protected readonly mcpService: McpTokenService,
    protected readonly auditsService: AuditsService,
    private readonly dataReflectionService: DataReflectionService,
    private readonly remoteImportService: RemoteImportService,
    private readonly syncService: SyncModuleService,
    private readonly scriptsService: ScriptsService,
    private readonly columnsService: ColumnsService,
    private readonly integrationsService: IntegrationsService,
    private readonly permissionsService: PermissionsService,
    protected readonly dashboardsService: DashboardsService,
    protected readonly actionsService: ActionsService,
    protected readonly mailService: MailService,
    protected readonly viewSettingsOverrideService: ViewSettingsOverrideService,
    protected readonly oAuthClientService: OauthClientService,
    protected readonly oAuthTokenService: OauthTokenService,
    private readonly utilsService: UtilsService,
    private readonly teamsV3Service: TeamsV3Service,
    private readonly usersService: UsersService,
    private readonly workspaceTeamsV3Service: WorkspaceTeamsV3Service,
    private readonly baseTeamsV3Service: BaseTeamsV3Service,
    private readonly workflowsService: WorkflowsService,
    private readonly workflowExecutionService: WorkflowExecutionService,
  ) {
    super(aclMiddleware, internalApiModules);
  }

  protected async checkAcl(operation: string, req, scope?: string) {
    if (scope === 'ncSkipAcl') {
      return;
    }
    await this.aclMiddleware.aclFn(
      operation,
      {
        scope,
      },
      null,
      req,
    );
  }

  @Get(['/api/v2/internal/:workspaceId/:baseId'])
  protected async internalAPI(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Query('operation') operation: string,
    @Req() req: NcRequest,
  ): InternalGETResponseType {
    await this.checkAcl(operation, req, OPERATION_SCOPES[operation]);

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
      case 'teamList':
        return await this.teamsV3Service.teamList(context, {
          workspaceOrOrgId: workspaceId,
        });
      case 'teamGet':
        return await this.teamsV3Service.teamGet(context, {
          workspaceOrOrgId: workspaceId,
          teamId: req.query.teamId as string,
        });
      case 'workspaceTeamList':
        return await this.workspaceTeamsV3Service.teamList(context, {
          workspaceId,
        });
      case 'workspaceTeamGet':
        return await this.workspaceTeamsV3Service.teamDetail(context, {
          workspaceId,
          teamId: req.query.teamId as string,
        });
      case 'baseTeamList':
        return await this.baseTeamsV3Service.teamList(context, {
          baseId,
        });
      case 'baseTeamGet':
        return await this.baseTeamsV3Service.teamDetail(context, {
          baseId,
          teamId: req.query.teamId as string,
        });
      case 'getUserProfile':
        return await this.usersService.getUserProfile(context, {
          req,
        });
      case 'templates': {
        return await this.utilsService.templates(req);
      }
      case 'template': {
        return await this.utilsService.template(req);
      }
      case 'workflowList':
        return await this.workflowsService.list(context);
      case 'workflowGet':
        return await this.workflowsService.get(
          context,
          req.query.workflowId as string,
        );
      case 'workflowNodes':
        return await this.workflowExecutionService.getWorkflowNodes(context);
      default:
        return await super.internalAPI(
          context,
          workspaceId,
          baseId,
          operation as any,
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
    await this.checkAcl(operation, req, OPERATION_SCOPES[operation]);

    switch (operation) {
      case 'createDataReflection':
        return await this.dataReflectionService.create(workspaceId);
      case 'deleteDataReflection':
        return await this.dataReflectionService.delete(workspaceId);
      case 'refreshDataReflection':
        return await this.dataReflectionService.refreshAccess(workspaceId);

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
        if (!payload.id) {
          NcError.genericNotFound('SyncConfig', payload.id);
        }

        return await this.syncService.triggerSync(context, {
          syncConfigId: payload.id,
          bulk: payload.bulk,
          req,
        });
      case 'updateSync':
        return await this.syncService.updateSync(
          context,
          payload.syncConfigId,
          payload,
          req,
        );
      case 'deleteSync':
        if (!payload.id) {
          NcError.genericNotFound('SyncConfig', payload.id);
        }
        return await this.syncService.deleteSync(context, payload.id, req);
      case 'migrateSync':
        if (!payload.id) {
          NcError.genericNotFound('SyncConfig', payload.id);
        }

        return await this.syncService.migrateSync(context, payload.id, req);
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
        return await this.permissionsService.dropPermission(
          context,
          payload,
          req,
        );

      case 'bulkDropPermissions':
        return await this.permissionsService.bulkDropPermissions(
          context,
          payload?.permissionIds || [],
          req,
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
      case 'triggerAction':
        return await this.actionsService.triggerAction(context, payload, req);

      case 'sendEmail':
        if (!isServiceUser(req.user, ServiceUserType.AUTOMATION_USER)) {
          NcError.notFound('Operation');
        }
        return await this.mailService.sendMailRaw(payload);
      case 'integrationRemoteFetch': {
        return await this.integrationsService.remoteFetch(context, payload);
      }
      case 'viewSettingOverride':
        return await this.viewSettingsOverrideService.overrideViewSetting(
          context,
          {
            destinationViewId: payload.destinationViewId,
            settingToOverride: payload.settingToOverride,
            sourceViewId: payload.sourceViewId,
            req,
          },
        );
      case 'teamCreate':
        return await this.teamsV3Service.teamCreate(context, {
          workspaceOrOrgId: workspaceId,
          team: payload,
          req,
        });
      case 'teamUpdate':
        return await this.teamsV3Service.teamUpdate(context, {
          workspaceOrOrgId: workspaceId,
          teamId: payload.teamId,
          team: payload,
          req,
        });
      case 'teamDelete':
        return await this.teamsV3Service.teamDelete(context, {
          workspaceOrOrgId: workspaceId,
          teamId: payload.teamId,
          req,
        });
      case 'teamMembersAdd':
        return await this.teamsV3Service.teamMembersAdd(context, {
          workspaceOrOrgId: workspaceId,
          teamId: payload.teamId,
          members: payload.members,
          req,
        });
      case 'teamMembersRemove':
        return await this.teamsV3Service.teamMembersRemove(context, {
          workspaceOrOrgId: workspaceId,
          teamId: payload.teamId,
          members: payload.members,
          req,
        });
      case 'teamMembersUpdate':
        return await this.teamsV3Service.teamMembersUpdate(context, {
          workspaceOrOrgId: workspaceId,
          teamId: payload.teamId,
          members: payload.members,
          req,
        });
      case 'workspaceTeamAdd': {
        // Handle both single object and array of objects
        const workspaceTeamsArray = Array.isArray(payload)
          ? payload
          : [payload];

        if (workspaceTeamsArray.length === 1) {
          // Single request
          return await this.workspaceTeamsV3Service.teamAdd(context, {
            workspaceId,
            team: workspaceTeamsArray[0],
            req,
          });
        } else {
          // Bulk request
          return await this.workspaceTeamsV3Service.teamAddBulk(context, {
            workspaceId,
            teams: { teams: workspaceTeamsArray },
            req,
          });
        }
      }
      case 'workspaceTeamUpdate':
        return await this.workspaceTeamsV3Service.teamUpdate(context, {
          workspaceId,
          team: payload,
          req,
        });
      case 'workspaceTeamRemove': {
        // Handle both single object and array of objects
        const workspaceRemoveTeamsArray = Array.isArray(payload)
          ? payload
          : [payload];

        if (workspaceRemoveTeamsArray.length === 1) {
          // Single request
          return await this.workspaceTeamsV3Service.teamRemove(context, {
            workspaceId,
            team: workspaceRemoveTeamsArray[0],
            req,
          });
        } else {
          // Bulk request
          return await this.workspaceTeamsV3Service.teamRemoveBulk(context, {
            workspaceId,
            teams: { teams: workspaceRemoveTeamsArray },
            req,
          });
        }
      }
      case 'baseTeamAdd': {
        // Handle both single object and array of objects
        const baseTeamsArray = Array.isArray(payload) ? payload : [payload];

        if (baseTeamsArray.length === 1) {
          // Single request
          return await this.baseTeamsV3Service.teamAdd(context, {
            baseId,
            team: baseTeamsArray[0],
            req,
          });
        } else {
          // Bulk request
          return await this.baseTeamsV3Service.teamAddBulk(context, {
            baseId,
            teams: { teams: baseTeamsArray },
            req,
          });
        }
      }
      case 'baseTeamUpdate':
        return await this.baseTeamsV3Service.teamUpdate(context, {
          baseId,
          team: payload,
          req,
        });
      case 'baseTeamRemove': {
        // Handle both single object and array of objects
        const baseRemoveTeamsArray = Array.isArray(payload)
          ? payload
          : [payload];

        if (baseRemoveTeamsArray.length === 1) {
          // Single request
          return await this.baseTeamsV3Service.teamRemove(context, {
            baseId,
            team: baseRemoveTeamsArray[0],
            req,
          });
        } else {
          // Bulk request
          return await this.baseTeamsV3Service.teamRemoveBulk(context, {
            baseId,
            teams: { teams: baseRemoveTeamsArray },
            req,
          });
        }
      }
      case 'workflowCreate':
        return await this.workflowsService.create(context, payload, req);
      case 'workflowUpdate':
        return await this.workflowsService.update(
          context,
          payload.workflowId,
          payload,
          req,
        );
      case 'workflowDelete':
        return await this.workflowsService.delete(
          context,
          payload.workflowId,
          req,
        );
      case 'workflowExecute':
        return await this.workflowsService.execute(
          context,
          payload.workflowId,
          {
            triggerData: payload.triggerData,
            triggerNodeTitle: payload.triggerNodeTitle,
          },
          req,
        );
      default:
        return await super.internalAPIPost(
          context,
          workspaceId,
          baseId,
          operation as any,
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
