import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { McpTokenService } from '~/services/mcp.service';
import { AuditsService } from '~/services/audits.service';
import { DashboardsService } from '~/services/dashboards.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcError } from '~/helpers/catchError';
import { AclMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';
import {
  InternalGETResponseType,
  InternalPOSTResponseType,
} from '~/utils/internal-type';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class InternalController {
  constructor(
    protected readonly mcpService: McpTokenService,
    protected readonly dashboardsService: DashboardsService,
    protected readonly aclMiddleware: AclMiddleware,
    protected readonly auditsService: AuditsService,
  ) {}

  protected get operationScopes() {
    return {
      mcpList: 'base',
      mcpCreate: 'base',
      mcpUpdate: 'base',
      mcpDelete: 'base',
      recordAuditList: 'base',
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
      widgetDataGet: 'base',
    };
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
    await this.checkAcl(operation, req, this.operationScopes[operation]);

    switch (operation) {
      case 'mcpList':
        return await this.mcpService.list(context, req);
      case 'mcpGet':
        return await this.mcpService.get(context, req.query.tokenId as string);
      case 'recordAuditList':
        return await this.auditsService.recordAuditList(context, {
          row_id: req.query.row_id as string,
          fk_model_id: req.query.fk_model_id as string,
          cursor: req.query.cursor as string,
        });
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
        return NcError.notFound('Operation');
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
      case 'mcpCreate':
        return await this.mcpService.create(context, payload, req);
      case 'mcpUpdate':
        return await this.mcpService.regenerateToken(
          context,
          payload.tokenId,
          payload,
        );
      case 'mcpDelete':
        return await this.mcpService.delete(context, payload.tokenId);
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
      default:
        NcError.notFound('Operation');
    }
  }
}
