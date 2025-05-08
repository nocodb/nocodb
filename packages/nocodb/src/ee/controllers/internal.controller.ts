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
import { SyncModuleService } from '~/integrations/sync/module/services/sync.service';
import { AclMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { ScriptsService } from '~/services/scripts.service';
import { getBaseSchema } from '~/helpers/scriptHelper';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class InternalController {
  constructor(
    private readonly aclMiddleware: AclMiddleware,
    private readonly dataReflectionService: DataReflectionService,
    private readonly remoteImportService: RemoteImportService,
    private readonly syncService: SyncModuleService,
    private readonly scriptsService: ScriptsService,
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
    createSyncTable: 'base',
    triggerSync: 'base',
    listScripts: 'base',
    getScript: 'base',
    createScript: 'base',
    updateScript: 'base',
    deleteScript: 'base',
    baseSchema: 'base',
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
      case 'listSync':
        return await this.syncService.listSync(
          context,
          req.query.fk_model_id,
          req,
        );
      case 'listScripts':
        return await this.scriptsService.listScripts(context, baseId);
      case 'getScript':
        return await this.scriptsService.getScript(context, req.query.scriptId);
      case 'baseSchema':
        return await getBaseSchema(baseId);
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
    @Body() payload: any,
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
          payload,
          req,
        );

      case 'abortRemoteImport':
        return await this.remoteImportService.abortRemoteImport(
          context,
          payload.secret,
          req,
        );

      case 'createSyncTable':
        return await this.syncService.createSyncTable(context, payload, req);
      case 'createSync':
        return await this.syncService.createSync(context, payload, req);
      case 'triggerSync':
        return await this.syncService.triggerSync(
          context,
          payload.syncConfigId,
          req,
        );
      case 'updateSync':
        return await this.syncService.updateSync(
          context,
          payload.syncConfigId,
          payload,
          req,
        );
      case 'deleteSync':
        return await this.syncService.deleteSync(
          context,
          payload.syncConfigId,
          req,
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
          payload.scriptId,
          payload,
        );

      case 'deleteScript':
        return await this.scriptsService.deleteScript(
          context,
          payload.scriptId,
        );

      default:
        return NcError.notFound('Operation');
    }
  }
}
