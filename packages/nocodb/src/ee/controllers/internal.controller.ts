import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { PagedResponseImpl } from '~/helpers/PagedResponse';
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
import { TablesService } from '~/services/tables.service';
import { ViewsService } from '~/services/views.service';
import { FiltersService } from '~/services/filters.service';
import { SortsService } from '~/services/sorts.service';
import { HooksService } from '~/services/hooks.service';
import { GridsService } from '~/services/grids.service';
import { FormsService } from '~/services/forms.service';
import { GalleriesService } from '~/services/galleries.service';
import { KanbansService } from '~/services/kanbans.service';
import { MapsService } from '~/services/maps.service';
import { CalendarsService } from '~/services/calendars.service';
import { ViewSettingsOverrideService } from '~/services/view-settings-override.service';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';
import { TeamsV3Service } from '~/services/v3/teams-v3.service';
import { UsersService } from '~/services/users/users.service';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';
import { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import { WorkspaceTeamsV3Service } from '~/services/v3/workspace-teams-v3.service';
import { BaseTeamsV3Service } from '~/services/v3/base-teams-v3.service';

@Controller()
export class InternalController extends InternalControllerCE {
  constructor(
    protected readonly aclMiddleware: AclMiddleware,
    @Inject(INTERNAL_API_MODULE_PROVIDER_KEY)
    protected readonly internalApiModules: InternalApiModule<any>[],
    protected readonly mcpService: McpTokenService,
    protected readonly auditsService: AuditsService,
    protected readonly tablesService: TablesService,
    protected readonly viewsService: ViewsService,
    protected readonly filtersService: FiltersService,
    protected readonly sortsService: SortsService,
    protected readonly hooksService: HooksService,
    protected readonly gridsService: GridsService,
    protected readonly formsService: FormsService,
    protected readonly galleriesService: GalleriesService,
    protected readonly kanbansService: KanbansService,
    protected readonly mapsService: MapsService,
    protected readonly calendarsService: CalendarsService,

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
    private readonly teamsV3Service: TeamsV3Service,
    private readonly usersService: UsersService,
    private readonly workspaceTeamsV3Service: WorkspaceTeamsV3Service,
    private readonly baseTeamsV3Service: BaseTeamsV3Service,
  ) {
    super(aclMiddleware, internalApiModules);
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
      case 'tableGet':
        return await this.tablesService.getTableWithAccessibleViews(context, {
          tableId: req.query.tableId,
          user: req.user,
        });
      case 'columnsHash':
        return await this.columnsService.columnsHash(
          context,
          req.query.tableId as string,
        );
      case 'viewList':
        return new PagedResponseImpl(
          await this.viewsService.viewList(context, {
            tableId: req.query.tableId as string,
            user: req.user,
          }),
        );
      case 'filterList':
        return new PagedResponseImpl(
          await this.filtersService.filterList(context, {
            viewId: req.query.viewId as string,
          }),
        );
      case 'filterChildrenList':
        return new PagedResponseImpl(
          await this.filtersService.filterChildrenList(context, {
            filterId: req.query.filterId as string,
          }),
        );
      case 'sortList':
        return new PagedResponseImpl(
          await this.sortsService.sortList(context, {
            viewId: req.query.viewId as string,
          }),
        );
      case 'hookList':
        return new PagedResponseImpl(
          await this.hooksService.hookList(context, {
            tableId: req.query.tableId as string,
          }),
        );
      case 'hookLogList':
        return new PagedResponseImpl(
          await this.hooksService.hookLogList(context, {
            hookId: req.query.hookId as string,
            query: req.query,
          }),
        );
      case 'hookSamplePayload':
        return await this.hooksService.hookSamplePayload(context, {
          event: req.query.event as string,
          tableId: req.query.tableId as string,
          operation: req.query.operation as string,
          version: req.query.version as string,
        });
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
  @HttpCode(200)
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
        if (!payload.syncConfigId) {
          NcError.genericNotFound('SyncConfig', payload.syncConfigId);
        }

        return await this.syncService.triggerSync(context, {
          syncConfigId: payload.syncConfigId,
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
      case 'tableUpdate':
        return await this.tablesService.tableUpdate(context, {
          tableId: req.query.tableId,
          table: payload,
          user: req.user,
          req,
        });
      case 'tableDelete':
        return await this.tablesService.tableDelete(context, {
          tableId: req.query.tableId,
          user: req.user,
          forceDeleteRelations: payload?.forceDeleteRelations,
          req,
        });
      case 'tableReorder':
        return await this.tablesService.reorderTable(context, {
          tableId: req.query.tableId,
          order: payload.order,
          req,
        });
      case 'columnCreate':
        return await this.columnsService.columnAdd(context, {
          tableId: req.query.tableId,
          column: payload,
          user: req.user,
          req,
        });
      case 'columnUpdate':
        return await this.columnsService.columnUpdate(context, {
          columnId: req.query.columnId,
          column: payload,
          user: req.user,
          req,
        });
      case 'columnDelete':
        return await this.columnsService.columnDelete(context, {
          columnId: req.query.columnId,
          user: req.user,
          req,
        });
      case 'columnPrimarySet':
        return await this.columnsService.columnSetAsPrimary(context, {
          columnId: req.query.columnId,
          req,
        });
      case 'columnsBulk':
        return await this.columnsService.columnBulk(
          context,
          req.query.tableId,
          payload,
          req,
        );
      case 'viewUpdate':
        return await this.viewsService.viewUpdate(context, {
          viewId: req.query.viewId,
          view: payload,
          user: req.user,
          req,
        });
      case 'viewDelete':
        return await this.viewsService.viewDelete(context, {
          viewId: req.query.viewId,
          user: req.user,
          req,
        });
      case 'viewShare':
        return await this.viewsService.shareView(context, {
          viewId: req.query.viewId,
          user: req.user,
          req,
        });
      case 'viewShareUpdate':
        return await this.viewsService.shareViewUpdate(context, {
          viewId: req.query.viewId,
          sharedView: payload,
          user: req.user,
          req,
        });
      case 'viewShareDelete':
        return await this.viewsService.shareViewDelete(context, {
          viewId: req.query.viewId,
          user: req.user,
          req,
        });
      case 'viewShowAll':
        return await this.viewsService.showAllColumns(context, {
          viewId: req.query.viewId,
          ignoreIds: req.query.ignoreIds,
        });
      case 'viewHideAll':
        return await this.viewsService.hideAllColumns(context, {
          viewId: req.query.viewId,
          ignoreIds: req.query.ignoreIds,
        });
      case 'filterCreate':
        return await this.filtersService.filterCreate(context, {
          viewId: req.query.viewId,
          filter: payload,
          user: req.user,
          req,
        });
      case 'filterUpdate':
        return await this.filtersService.filterUpdate(context, {
          filterId: req.query.filterId,
          filter: payload,
          user: req.user,
          req,
        });
      case 'filterDelete':
        return await this.filtersService.filterDelete(context, {
          filterId: req.query.filterId,
          req,
        });
      case 'sortCreate':
        return await this.sortsService.sortCreate(context, {
          viewId: req.query.viewId,
          sort: payload,
          req,
        });
      case 'sortUpdate':
        return await this.sortsService.sortUpdate(context, {
          sortId: req.query.sortId,
          sort: payload,
          req,
        });
      case 'sortDelete':
        return await this.sortsService.sortDelete(context, {
          sortId: req.query.sortId,
          req,
        });
      case 'hookCreate':
        return await this.hooksService.hookCreate(context, {
          tableId: req.query.tableId,
          hook: payload,
          req,
        });
      case 'hookUpdate':
        return await this.hooksService.hookUpdate(context, {
          hookId: req.query.hookId,
          hook: payload,
          req,
        });
      case 'hookDelete':
        return await this.hooksService.hookDelete(context, {
          hookId: req.query.hookId,
          req,
        });
      case 'hookTest':
        return await this.hooksService.hookTest(context, {
          hookTest: {
            ...payload,
            payload: {
              ...payload.payload,
              user: req.user,
            },
          },
          tableId: req.query.tableId,
          req,
        });
      case 'gridViewCreate':
        return await this.gridsService.gridViewCreate(context, {
          grid: payload,
          tableId: req.query.tableId,
          req,
        });
      case 'formViewCreate':
        return await this.formsService.formViewCreate(context, {
          body: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'galleryViewCreate':
        return await this.galleriesService.galleryViewCreate(context, {
          gallery: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'kanbanViewCreate':
        return await this.kanbansService.kanbanViewCreate(context, {
          kanban: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'mapViewCreate':
        return await this.mapsService.mapViewCreate(context, {
          map: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'calendarViewCreate':
        return await this.calendarsService.calendarViewCreate(context, {
          calendar: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'gridViewUpdate':
        return await this.gridsService.gridViewUpdate(context, {
          viewId: req.query.viewId,
          grid: payload,
          req,
        });
      case 'formViewUpdate':
        return await this.formsService.formViewUpdate(context, {
          formViewId: req.query.viewId,
          form: payload,
          req,
        });
      case 'galleryViewUpdate':
        return await this.galleriesService.galleryViewUpdate(context, {
          galleryViewId: req.query.viewId,
          gallery: payload,
          req,
        });
      case 'kanbanViewUpdate':
        return await this.kanbansService.kanbanViewUpdate(context, {
          kanbanViewId: req.query.viewId,
          kanban: payload,
          req,
        });
      case 'mapViewUpdate':
        return await this.mapsService.mapViewUpdate(context, {
          mapViewId: req.query.viewId,
          map: payload,
          req,
        });
      case 'calendarViewUpdate':
        return await this.calendarsService.calendarViewUpdate(context, {
          calendarViewId: req.query.viewId,
          calendar: payload,
          req,
        });
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
