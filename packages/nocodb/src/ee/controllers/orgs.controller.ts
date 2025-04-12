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
import { DomainReqType } from 'nocodb-sdk';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { OrgsService } from '~/services/orgs.service';
import { NcRequest } from '~/interface/config';

@Controller()
export class OrgsController {
  constructor(protected readonly orgsService: OrgsService) {}

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
    return this.orgsService.addDomain({
      orgId,
      workspaceId,
      req,
      body,
    });
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
    return this.orgsService.verifyDomain({
      req,
      domainId,
    });
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
    return this.orgsService.updateDomain({
      req,
      domain: body,
      domainId,
    });
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
    @Body() body: { orgId: string; workspaceId: string; workspaceName: string },
  ) {
    return this.orgsService.deleteWorkspace({
      workspaceId: body.workspaceId,
      req,
      user: req.user,
    });
  }
}
