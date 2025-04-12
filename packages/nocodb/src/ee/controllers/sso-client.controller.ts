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
} from '@nestjs/common';
import {
  CloudOrgUserRoles,
  OrgUserRoles,
  SSOClientType,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { SSOClientService } from '~/services/sso-client.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { OrgSSOClientService } from '~/services/org-sso-client.service';

@Controller()
export class SsoClientController {
  constructor(
    private readonly ssoClientService: SSOClientService,
    private readonly orgSsoClientService: OrgSSOClientService,
  ) {}

  /**
   * Enterprise(self-hosted) SSO Clients related APIs
   ***/
  @Get('/api/v2/sso-clients')
  @Acl('ssoClientList', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async clientList(@Req() req) {
    const clients = await this.ssoClientService.clientList({ req });
    return new PagedResponseImpl(clients);
  }

  @Post('/api/v2/sso-clients')
  @Acl('ssoClientCreate', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  @HttpCode(200)
  async clientAdd(@Body() client: SSOClientType, @Req() req) {
    return this.ssoClientService.clientAdd({ client, req });
  }

  @Patch('/api/v2/sso-clients/:clientId')
  @Acl('ssoClientUpdate', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async clientUpdate(
    @Param('clientId') clientId: string,
    @Body() client: SSOClientType,
    @Req() req,
  ) {
    return this.ssoClientService.clientUpdate({ clientId, client, req });
  }

  @Delete('/api/v2/sso-clients/:clientId')
  @Acl('ssoClientDelete', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async clientDelete(@Param('clientId') clientId: string, @Req() req) {
    return this.ssoClientService.clientDelete({ clientId, req });
  }

  /**
   * Organization(cloud) SSO Clients related APIs
   ***/
  @Get('/api/v2/orgs/:orgId/sso-clients')
  @Acl('orgSsoClientList', {
    scope: 'cloud-org',
    allowedRoles: [CloudOrgUserRoles.OWNER],
    blockApiTokenAccess: true,
  })
  async orgClientList(@Req() req, @Param('orgId') orgId: string) {
    const clients = await this.ssoClientService.clientList({ req, orgId });
    return new PagedResponseImpl(clients);
  }

  @Post('/api/v2/orgs/:orgId/sso-clients')
  @Acl('orgSsoClientCreate', {
    scope: 'cloud-org',
    allowedRoles: [CloudOrgUserRoles.OWNER],
    blockApiTokenAccess: true,
  })
  @HttpCode(200)
  async orgClientAdd(
    @Body() client: SSOClientType,
    @Req() req,
    @Param('orgId') orgId: string,
  ) {
    return this.ssoClientService.clientAdd({ client, req, orgId });
  }

  @Patch('/api/v2/orgs/:orgId/sso-clients/:clientId')
  @Acl('orgSsoClientUpdate', {
    scope: 'cloud-org',
    allowedRoles: [CloudOrgUserRoles.OWNER],
    blockApiTokenAccess: true,
  })
  async orgClientUpdate(
    @Param('clientId') clientId: string,
    @Body() client: SSOClientType,
    @Req() req,
    @Param('orgId') orgId: string,
  ) {
    return this.ssoClientService.clientUpdate({ clientId, client, req, orgId });
  }

  @Delete('/api/v2/orgs/:orgId/sso-clients/:clientId')
  @Acl('orgSsoClientDelete', {
    scope: 'cloud-org',
    allowedRoles: [CloudOrgUserRoles.OWNER],
    blockApiTokenAccess: true,
  })
  async orgClientDelete(
    @Param('clientId') clientId: string,
    @Req() req,
    @Param('orgId') orgId: string,
  ) {
    return this.ssoClientService.clientDelete({ clientId, req, orgId });
  }

  /**
   * Workspace(cloud) SSO Clients related APIs
   ***/
  @Get('/api/v2/workspaces/:workspaceId/sso-clients')
  @Acl('workspaceSsoClientList', {
    scope: 'workspace',
    allowedRoles: [WorkspaceUserRoles.OWNER],
    blockApiTokenAccess: true,
  })
  async workspaceClientList(
    @Req() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    const clients = await this.ssoClientService.clientList({
      req,
      workspaceId,
    });
    return new PagedResponseImpl(clients);
  }

  @Post('/api/v2/workspaces/:workspaceId/sso-clients')
  @Acl('workspaceSsoClientCreate', {
    scope: 'workspace',
    allowedRoles: [WorkspaceUserRoles.OWNER],
    blockApiTokenAccess: true,
  })
  @HttpCode(200)
  async workspaceClientAdd(
    @Body() client: SSOClientType,
    @Req() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.ssoClientService.clientAdd({ client, req, workspaceId });
  }

  @Patch('/api/v2/workspaces/:workspaceId/sso-clients/:clientId')
  @Acl('workspaceSsoClientUpdate', {
    scope: 'workspace',
    allowedRoles: [WorkspaceUserRoles.OWNER],
    blockApiTokenAccess: true,
  })
  async workspaceClientUpdate(
    @Param('clientId') clientId: string,
    @Body() client: SSOClientType,
    @Req() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.ssoClientService.clientUpdate({
      clientId,
      client,
      req,
      workspaceId,
    });
  }

  @Delete('/api/v2/workspaces/:workspaceId/sso-clients/:clientId')
  @Acl('workspaceSsoClientDelete', {
    scope: 'workspace',
    allowedRoles: [WorkspaceUserRoles.OWNER],
    blockApiTokenAccess: true,
  })
  async workspaceClientDelete(
    @Param('clientId') clientId: string,
    @Req() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.ssoClientService.clientDelete({ clientId, req, workspaceId });
  }

  @Post('/api/v2/sso')
  async ssoClients(@Body() body: { email: string }, @Req() req) {
    return this.ssoClientService.getSsoClientsByDomain({
      req,
      email: body.email,
    });
  }
}
