import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import type { InternalApiModule } from '~/controllers/internal/types';
import { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/controllers/internal/types';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
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
    protected readonly aclMiddleware: AclMiddleware,
    @Inject(INTERNAL_API_MODULE_PROVIDER_KEY)
    protected readonly internalApiModules: InternalApiModule[],
  ) {}

  protected async checkAcl(
    operation: keyof typeof OPERATION_SCOPES,
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
    @Query('operation') operation: keyof typeof OPERATION_SCOPES,
    @Req() req: NcRequest,
  ): InternalGETResponseType {
    await this.checkAcl(operation, req, OPERATION_SCOPES[operation]);
    const module = this.internalApiModules.find(
      (mod) => mod.httpMethod === 'GET' && mod.operation === operation,
    );
    if (module) {
      return await module.handle(context, {
        workspaceId,
        baseId,
        operation,
        req,
      });
    }
    return NcError.notFound('Operation');
  }

  @Post(['/api/v2/internal/:workspaceId/:baseId'])
  protected async internalAPIPost(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Query('operation') operation: keyof typeof OPERATION_SCOPES,
    @Body() payload: any,
    @Req() req: NcRequest,
  ): InternalPOSTResponseType {
    await this.checkAcl(operation, req, OPERATION_SCOPES[operation]);

    const module = this.internalApiModules.find(
      (mod) => mod.httpMethod === 'POST' && mod.operation === operation,
    );
    if (module) {
      return await module.handle(context, {
        workspaceId,
        baseId,
        operation,
        req,
        payload,
      });
    }
    return NcError.notFound('Operation');
  }
}
