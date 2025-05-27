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

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class InternalController {
  constructor(
    protected readonly mcpService: McpTokenService,
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
          page: req.query.page ? parseInt(req.query.page || '1') : undefined,
        });
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
      default:
        NcError.notFound('Operation');
    }
  }
}
