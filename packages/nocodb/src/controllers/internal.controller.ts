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
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcError } from '~/helpers/catchError';
import { AclMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';
import {
  InternalGETResponseType,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class InternalController {
  constructor(
    protected readonly mcpService: McpTokenService,
    protected readonly aclMiddleware: AclMiddleware,
    protected readonly auditsService: AuditsService,
    protected readonly oAuthClientService: OauthClientService,
    protected readonly oAuthTokenService: OauthTokenService,
  ) {}

  protected get operationScopes() {
    return {
      mcpList: 'base',
      mcpCreate: 'base',
      mcpUpdate: 'base',
      mcpDelete: 'base',
      mcpGet: 'base',
      recordAuditList: 'base',
      oAuthClientList: 'org',
      oAuthClientCreate: 'org',
      oAuthClientUpdate: 'org',
      oAuthClientDelete: 'org',
      oAuthClientGet: 'org',
      oAuthAuthorizationList: 'org',
      oAuthAuthorizationRevoke: 'org',
      oAuthClientRegenerateSecret: 'org',
    } as const;
  }

  protected async checkAcl(
    operation: keyof typeof this.operationScopes,
    req: NcRequest,
    scope?: string,
  ) {
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
    @Query('operation') operation: keyof typeof this.operationScopes,
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
      case 'oAuthClientGet':
        return await this.oAuthClientService.getClient(context, {
          clientId: req.query.clientId as string,
          req,
        });
      case 'oAuthClientList':
        return await this.oAuthClientService.listClients(context, req);
      case 'oAuthAuthorizationList':
        return await this.oAuthTokenService.listUserAuthorizations(req.user.id);
      default:
        return NcError.notFound('Operation');
    }
  }

  @Post(['/api/v2/internal/:workspaceId/:baseId'])
  protected async internalAPIPost(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Query('operation') operation: keyof typeof this.operationScopes,
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
      case 'oAuthClientCreate':
        return await this.oAuthClientService.createClient(
          context,
          payload,
          req,
        );
      case 'oAuthClientUpdate':
        return await this.oAuthClientService.updateClient(context, {
          clientId: req.query.clientId as string,
          body: payload,
          req,
        });
      case 'oAuthClientDelete':
        return await this.oAuthClientService.deleteClient(context, {
          clientId: req.query.clientId as string,
          req,
        });
      case 'oAuthAuthorizationRevoke':
        await this.oAuthTokenService.revokeUserAuthorization(
          req.user.id,
          payload.tokenId,
        );
        return { success: true };
      case 'oAuthClientRegenerateSecret':
        return await this.oAuthClientService.regenerateClientSecret(context, {
          clientId: req.query.clientId as string,
          req,
        });
      default:
        NcError.notFound('Operation');
    }
  }
}
