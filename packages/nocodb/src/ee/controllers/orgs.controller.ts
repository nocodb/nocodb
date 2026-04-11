import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppEvents, DomainReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { License } from '~/decorators/license.decorator';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { OrgsService } from '~/services/orgs.service';
import { AuditsService } from '~/services/audits.service';
import { NcError } from '~/helpers/catchError';
import { NcRequest } from '~/interface/config';
import { checkIfWorkspaceSSOAvail } from '~/helpers/paymentHelpers';
import { Domain, Workspace } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Noco from '~/Noco';

@Controller()
@License('organizations')
export class OrgsController {
  constructor(
    protected readonly orgsService: OrgsService,
    protected readonly auditsService: AuditsService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  @UseGuards(AuthGuard('basic'))
  @Post('/api/internal/orgs')
  async createOrg(
    @Body() body: { title: string; userId: string; dbServerId?: string },
  ) {
    return this.orgsService.createOrg({
      title: body.title,
      userId: body.userId,
      dbServerId: body.dbServerId,
    });
  }

  @Get('/api/v2/orgs/:orgId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgGet', {
    scope: 'cloud-org',
  })
  async getOrg(@Req() req: NcRequest, @Param('orgId') orgId: string) {
    return this.orgsService.readOrg({
      orgId: orgId,
      user: req.user,
      req,
    });
  }

  @Get('/api/v2/orgs/:orgId/bases')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgBaseList', {
    scope: 'cloud-org',
  })
  async orgBaseList(@Req() req: NcRequest, @Param('orgId') orgId: string) {
    return new PagedResponseImpl(
      await this.orgsService.baseList({
        orgId,
        req,
      }),
    );
  }

  @Patch('/api/v2/orgs/:orgId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgUpdate', {
    scope: 'cloud-org',
  })
  async updateOrg(
    @Req() req: NcRequest,
    @Param('orgId') orgId: string,
    @Body() body: { orgId: string; orgName: string; image: string },
  ) {
    return this.orgsService.updateOrg({
      orgId: orgId,
      org: body,
      user: req.user,
      req,
    });
  }

  // update workspace
  @Patch('/api/v2/orgs/:orgId/workspaces/:workspaceId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgWorkspaceUpdate', {
    scope: 'cloud-org',
  })
  async updateWorkspace(
    @Req() req: NcRequest,
    @Body() body: { orgId: string; workspaceId: string; workspaceName: string },
  ) {
    return this.orgsService.updateWorkspace({
      workspaceId: body.workspaceId,
      req,
      user: req.user,
    });
  }

  // delete workspace
  @Delete('/api/v2/orgs/:orgId/workspaces/:workspaceId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgWorkspaceRemove', {
    scope: 'cloud-org',
  })
  async removeWorkspace(
    @Req() req: NcRequest,
    @Body() body: { orgId: string; workspaceId: string; workspaceName: string },
  ) {
    return this.orgsService.deleteWorkspace({
      workspaceId: body.workspaceId,
      req,
      user: req.user,
    });
  }

  @Get([
    '/api/v2/orgs/:orgId/domains',
    '/api/v2/workspaces/:workspaceId/domains',
  ])
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgDomainList', {
    scope: 'cloud-org',
    extendedScope: 'workspace',
  })
  async orgWorkspaceList(
    @Req() req: NcRequest,
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return new PagedResponseImpl(
      await this.orgsService.domainList({
        orgId,
        workspaceId,
        req,
      }),
    );
  }

  @Post([
    '/api/v2/orgs/:orgId/domains',
    '/api/v2/workspaces/:workspaceId/domains',
  ])
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgDomainAdd', {
    scope: 'cloud-org',
    extendedScope: 'workspace',
  })
  async addDomain(
    @Req() req: NcRequest,
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() body: DomainReqType,
  ) {
    // TODO: move this to middleware/guard
    if (req.ncWorkspaceId) {
      await checkIfWorkspaceSSOAvail(req.ncWorkspaceId);
    }
    const result = await this.orgsService.addDomain({
      orgId,
      workspaceId,
      req,
      body,
    });

    let resolvedOrgId = orgId;
    if (!resolvedOrgId && workspaceId) {
      const ws = await Workspace.get(workspaceId);
      resolvedOrgId = ws?.fk_org_id;
    }
    this.appHooksService.emit(AppEvents.ORG_DOMAIN_ADD as any, {
      orgId: resolvedOrgId || Noco.ncDefaultOrgId,
      domainName: body.domain,
      req,
    });

    return result;
  }

  @Post('/api/v2/domains/:domainId/verify')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgDomainVerify', {
    scope: 'cloud-org',
    extendedScope: 'workspace',
  })
  async verifyDomain(
    @Req() req: NcRequest,
    @Param('domainId') domainId: string,
  ) {
    // TODO: move this to middleware/guard
    if (req.ncWorkspaceId) {
      await checkIfWorkspaceSSOAvail(req.ncWorkspaceId);
    }

    const result = await this.orgsService.verifyDomain({
      req,
      domainId,
    });

    const verifiedDomain = await Domain.get(domainId);
    this.appHooksService.emit(AppEvents.ORG_DOMAIN_VERIFY as any, {
      orgId: verifiedDomain?.fk_org_id || Noco.ncDefaultOrgId,
      domainName: verifiedDomain?.domain,
      domainId,
      req,
    });

    return result;
  }

  @Patch('/api/v2/domains/:domainId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgDomainUpdate', {
    scope: 'cloud-org',
    extendedScope: 'workspace',
  })
  async updateDomain(
    @Req() req: NcRequest,
    @Body() body: DomainReqType,
    @Param('domainId') domainId: string,
  ) {
    // TODO: move this to middleware/guard
    if (req.ncWorkspaceId) {
      await checkIfWorkspaceSSOAvail(req.ncWorkspaceId);
    }
    const result = await this.orgsService.updateDomain({
      req,
      domain: body,
      domainId,
    });

    const updatedDomain = await Domain.get(domainId);
    this.appHooksService.emit(AppEvents.ORG_DOMAIN_UPDATE as any, {
      orgId: updatedDomain?.fk_org_id || Noco.ncDefaultOrgId,
      domainName: body.domain || updatedDomain?.domain,
      domainId,
      req,
    });

    return result;
  }

  @Delete('/api/v2/domains/:domainId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgDomainDelete', {
    scope: 'cloud-org',
    extendedScope: 'workspace',
  })
  async deleteDomain(
    @Req() req: NcRequest,
    @Param('domainId') domainId: string,
  ) {
    // Fetch before delete to capture org context for audit
    const domainRecord = await Domain.get(domainId);

    const result = await this.orgsService.deleteDomain({
      domainId,
    });

    this.appHooksService.emit(AppEvents.ORG_DOMAIN_DELETE as any, {
      orgId: domainRecord?.fk_org_id || Noco.ncDefaultOrgId,
      domainName: domainRecord?.domain,
      domainId,
      req,
    });

    return result;
  }

  @Get('/api/v2/orgs/:orgId/audits')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgAuditList', {
    scope: 'cloud-org',
  })
  async orgAuditList(
    @Req() req: NcRequest,
    @Param('orgId') orgId: string,
  ) {
    // Validate workspaceIds belong to this org
    let workspaceIds: string[] | undefined;
    if (req.query.workspaceIds) {
      workspaceIds = ([] as string[]).concat(req.query.workspaceIds as string | string[]);

      // Single query: list all org workspaces and check membership
      const orgWorkspaces = await Workspace.listByOrgId({ orgId });
      const orgWsIds = new Set(orgWorkspaces.map((ws) => ws.id));

      for (const wsId of workspaceIds) {
        if (!orgWsIds.has(wsId)) {
          NcError.badRequest(
            `Workspace '${wsId}' does not belong to this organization`,
          );
        }
      }
    }

    return await this.auditsService.orgAuditList(orgId, {
      cursor: req.query.cursor as string,
      workspaceIds,
      fkUserId: req.query.fkUserId as string,
      type: req.query.type as string[],
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      orderBy: req.query.orderBy as any,
    });
  }
}
