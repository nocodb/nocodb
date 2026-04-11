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
  AppEvents,
  CloudOrgUserRoles,
  OrgUserRoles,
  SSOClientType,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { SSOClientService } from '~/services/sso-client.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { OrgSSOClientService } from '~/services/org-sso-client.service';
import { checkIfWorkspaceSSOAvail } from '~/helpers/paymentHelpers';
import { License } from '~/decorators/license.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Noco from '~/Noco';

@Controller()
@License('sso')
export class SsoClientController {
  constructor(
    private readonly ssoClientService: SSOClientService,
    private readonly orgSsoClientService: OrgSSOClientService,
    private readonly appHooksService: AppHooksService,
  ) {}

  /**
   * Enterprise(self-hosted) SSO Clients related APIs
   ***/
  @Get('/api/v2/sso-clients')
  @Acl('ssoClientList', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
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
    blockOAuthTokenAccess: true,
  })
  @HttpCode(200)
  async clientAdd(@Body() client: SSOClientType, @Req() req) {
    const result = await this.ssoClientService.clientAdd({ client, req });

    this.appHooksService.emit(AppEvents.SSO_CLIENT_CREATE as any, {
      orgId: Noco.ncDefaultOrgId,
      title: client.title,
      req,
    });

    return result;
  }

  @Patch('/api/v2/sso-clients/:clientId')
  @Acl('ssoClientUpdate', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async clientUpdate(
    @Param('clientId') clientId: string,
    @Body() client: SSOClientType,
    @Req() req,
  ) {
    const result = await this.ssoClientService.clientUpdate({ clientId, client, req });

    this.appHooksService.emit(AppEvents.SSO_CLIENT_UPDATE as any, {
      orgId: Noco.ncDefaultOrgId,
      title: client.title,
      clientId,
      req,
    });

    return result;
  }

  @Delete('/api/v2/sso-clients/:clientId')
  @Acl('ssoClientDelete', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async clientDelete(@Param('clientId') clientId: string, @Req() req) {
    const result = await this.ssoClientService.clientDelete({ clientId, req });

    this.appHooksService.emit(AppEvents.SSO_CLIENT_DELETE as any, {
      orgId: Noco.ncDefaultOrgId,
      clientId,
      req,
    });

    return result;
  }

  /**
   * Organization(cloud) SSO Clients related APIs
   ***/
  @Get('/api/v2/orgs/:orgId/sso-clients')
  @Acl('orgSsoClientList', {
    scope: 'cloud-org',
    allowedRoles: [CloudOrgUserRoles.OWNER],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
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
    blockOAuthTokenAccess: true,
  })
  @HttpCode(200)
  async orgClientAdd(
    @Body() client: SSOClientType,
    @Req() req,
    @Param('orgId') orgId: string,
  ) {
    const result = await this.ssoClientService.clientAdd({ client, req, orgId });

    this.appHooksService.emit(AppEvents.SSO_CLIENT_CREATE as any, {
      orgId,
      title: client.title,
      req,
    });

    return result;
  }

  @Patch('/api/v2/orgs/:orgId/sso-clients/:clientId')
  @Acl('orgSsoClientUpdate', {
    scope: 'cloud-org',
    allowedRoles: [CloudOrgUserRoles.OWNER],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async orgClientUpdate(
    @Param('clientId') clientId: string,
    @Body() client: SSOClientType,
    @Req() req,
    @Param('orgId') orgId: string,
  ) {
    const result = await this.ssoClientService.clientUpdate({ clientId, client, req, orgId });

    this.appHooksService.emit(AppEvents.SSO_CLIENT_UPDATE as any, {
      orgId,
      title: client.title,
      clientId,
      req,
    });

    return result;
  }

  @Delete('/api/v2/orgs/:orgId/sso-clients/:clientId')
  @Acl('orgSsoClientDelete', {
    scope: 'cloud-org',
    allowedRoles: [CloudOrgUserRoles.OWNER],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async orgClientDelete(
    @Param('clientId') clientId: string,
    @Req() req,
    @Param('orgId') orgId: string,
  ) {
    const result = await this.ssoClientService.clientDelete({ clientId, req, orgId });

    this.appHooksService.emit(AppEvents.SSO_CLIENT_DELETE as any, {
      orgId,
      clientId,
      req,
    });

    return result;
  }

  /**
   * Workspace(cloud) SSO Clients related APIs
   ***/
  @Get('/api/v2/workspaces/:workspaceId/sso-clients')
  @Acl('workspaceSsoClientList', {
    scope: 'workspace',
    allowedRoles: [WorkspaceUserRoles.OWNER],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async workspaceClientList(
    @Req() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    // TODO: move this to middleware/guard
    if (req.ncWorkspaceId) {
      await checkIfWorkspaceSSOAvail(req.ncWorkspaceId);
    }
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
    blockOAuthTokenAccess: true,
  })
  @HttpCode(200)
  async workspaceClientAdd(
    @Body() client: SSOClientType,
    @Req() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    // TODO: move this to middleware/guard
    if (req.ncWorkspaceId) {
      await checkIfWorkspaceSSOAvail(req.ncWorkspaceId);
    }
    return this.ssoClientService.clientAdd({ client, req, workspaceId });
  }

  @Patch('/api/v2/workspaces/:workspaceId/sso-clients/:clientId')
  @Acl('workspaceSsoClientUpdate', {
    scope: 'workspace',
    allowedRoles: [WorkspaceUserRoles.OWNER],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async workspaceClientUpdate(
    @Param('clientId') clientId: string,
    @Body() client: SSOClientType,
    @Req() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    // TODO: move this to middleware/guard
    if (req.ncWorkspaceId) {
      await checkIfWorkspaceSSOAvail(req.ncWorkspaceId);
    }
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
    blockOAuthTokenAccess: true,
  })
  async workspaceClientDelete(
    @Param('clientId') clientId: string,
    @Req() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    // TODO: move this to middleware/guard
    if (req.ncWorkspaceId) {
      await checkIfWorkspaceSSOAvail(req.ncWorkspaceId);
    }
    return this.ssoClientService.clientDelete({ clientId, req, workspaceId });
  }

  @Post('/api/v2/sso')
  async ssoClients(@Body() body: { email: string }, @Req() req) {
    // TODO: move this to middleware/guard
    if (req.ncWorkspaceId) {
      await checkIfWorkspaceSSOAvail(req.ncWorkspaceId);
    }
    return this.ssoClientService.getSsoClientsByDomain({
      req,
      email: body.email,
    });
  }
}
