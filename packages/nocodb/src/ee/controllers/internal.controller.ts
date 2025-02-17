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
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { DataReflectionService } from '~/services/data-reflection.service';
import { RemoteImportService } from '~/modules/jobs/jobs/export-import/remote-import.service';
import { AclMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class InternalController {
  constructor(
    private readonly aclMiddleware: AclMiddleware,
    private readonly dataReflectionService: DataReflectionService,
    private readonly remoteImportService: RemoteImportService,
  ) {}

  async checkAcl(operation: string, req, scope?: string) {
    await this.aclMiddleware.aclFn(
      operation,
      {
        scope,
      },
      null,
      req,
    );
  }

  operationScopes = {
    createDataReflection: 'workspace',
    getDataReflection: 'workspace',
    deleteDataReflection: 'workspace',
    listenRemoteImport: 'workspace',
  };

  @Get(['/api/v2/internal/:workspaceId/:baseId'])
  async internalAPI(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Query('operation') operation: string,
    @Req() req: NcRequest,
  ) {
    await this.checkAcl(operation, req, this.operationScopes[operation]);

    switch (operation) {
      case 'getDataReflection':
        return await this.dataReflectionService.get(workspaceId);
      default:
        return NcError.notFound('Operation');
    }
  }

  @Post(['/api/v2/internal/:workspaceId/:baseId'])
  async internalAPIPost(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Query('operation') operation: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    await this.checkAcl(operation, req, this.operationScopes[operation]);

    switch (operation) {
      case 'createDataReflection':
        return await this.dataReflectionService.create(workspaceId);

      case 'deleteDataReflection':
        return await this.dataReflectionService.delete(workspaceId);

      case 'listenRemoteImport':
        return await this.remoteImportService.remoteImport(
          context,
          workspaceId,
          body,
          req,
        );

      case 'abortRemoteImport':
        return await this.remoteImportService.abortRemoteImport(
          context,
          body.secret,
          req,
        );

      default:
        return NcError.notFound('Operation');
    }
  }
}
