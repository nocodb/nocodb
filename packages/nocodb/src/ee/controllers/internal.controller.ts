import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { InternalController as InternalControllerCE } from 'src/controllers/internal.controller';
import { DataReflectionService } from '~/services/data-reflection.service';
import { RemoteImportService } from '~/modules/jobs/jobs/export-import/remote-import.service';
import { SyncModuleService } from '~/integrations/sync/module/services/sync.service';
import { McpTokenService } from '~/services/mcp.service';
import {
  Acl,
  AclMiddleware,
} from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { ScriptsService } from '~/services/scripts.service';
import { getBaseSchema } from '~/helpers/scriptHelper';
import { NcError } from '~/helpers/catchError';
import { IntegrationsService } from '~/services/integrations.service';
import {
  InternalGETResponseType,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { ColumnsService } from '~/services/columns.service';

@Controller()
export class InternalController extends InternalControllerCE {
  constructor(
    protected readonly mcpService: McpTokenService,
    protected readonly aclMiddleware: AclMiddleware,
    private readonly dataReflectionService: DataReflectionService,
    private readonly remoteImportService: RemoteImportService,
    private readonly syncService: SyncModuleService,
    private readonly scriptsService: ScriptsService,
    private readonly columnsService: ColumnsService,
    private readonly integrationsService: IntegrationsService,
  ) {
    super(mcpService, aclMiddleware);
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

  protected get operationScopes() {
    return {
      ...super.operationScopes,
      createDataReflection: 'workspace',
      getDataReflection: 'workspace',
      deleteDataReflection: 'workspace',
      listenRemoteImport: 'workspace',
      createSync: 'base',
      triggerSync: 'base',
      migrateSync: 'base',
      addChildSync: 'base',
      authIntegrationTestConnection: 'workspace',
      syncIntegrationFetchOptions: 'workspace',
      listScripts: 'base',
      getScript: 'base',
      createScript: 'base',
      updateScript: 'base',
      deleteScript: 'base',
      baseSchema: 'base',
    };
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
      case 'getDataReflection':
        return await this.dataReflectionService.get(workspaceId);
      case 'listSync':
        return await this.syncService.listSync(context, req);
      case 'readSync':
        return await this.syncService.readSync(context, req.query.id);
      case 'listScripts':
        return await this.scriptsService.listScripts(context, baseId);
      case 'getScript':
        return await this.scriptsService.getScript(context, req.query.id);
      case 'baseSchema':
        return await getBaseSchema(baseId);
      case 'mcpList':
        return await this.mcpService.list(context, req);
      case 'mcpGet':
        return await this.mcpService.get(context, req.query.tokenId as string);
      default:
        return await super.internalAPI(
          context,
          workspaceId,
          baseId,
          operation,
          req,
        );
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

      case 'createSync':
        return await this.syncService.createSync(context, payload, req);
      case 'triggerSync':
        if (!payload.syncConfigId) {
          NcError.genericNotFound('SyncConfig', payload.syncConfigId);
        }

        return await this.syncService.triggerSync(
          context,
          payload.syncConfigId,
          payload.bulk,
          req,
        );
      case 'updateSync':
        if (!payload.syncConfigId) {
          NcError.genericNotFound('SyncConfig', payload.syncConfigId);
        }

        return await this.syncService.updateSync(
          context,
          payload.syncConfigId,
          payload,
          req,
        );
      case 'deleteSync':
        if (!payload.syncConfigId) {
          NcError.genericNotFound('SyncConfig', payload.syncConfigId);
        }

        return await this.syncService.deleteSync(
          context,
          payload.syncConfigId,
          req,
        );
      case 'migrateSync':
        if (!payload.syncConfigId) {
          NcError.genericNotFound('SyncConfig', payload.syncConfigId);
        }

        return await this.syncService.migrateSync(
          context,
          payload.syncConfigId,
          req,
        );
      case 'syncIntegrationFetchOptions':
        return await this.syncService.integrationFetchOptions(context, {
          integration: payload.integration,
          key: payload.key,
        });
      case 'authIntegrationTestConnection':
        return await this.integrationsService.authIntegrationTestConnection(
          payload,
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
          payload.id,
          payload,
        );

      case 'deleteScript':
        return await this.scriptsService.deleteScript(context, payload.id);

      default:
        return await super.internalAPIPost(
          context,
          workspaceId,
          baseId,
          operation,
          payload,
          req,
        );
    }
  }

  @Get(['/api/v1/db/internal/links/:columnId/tables/:refTableId'])
  @Acl('tableGet')
  async tableGet(
    @TenantContext() context: NcContext,
    @Param('columnId') columnId: string,
    @Param('refTableId') refTableId: string,
  ) {
    const table = await this.columnsService.getLinkColumnRefTable(context, {
      columnId,
      tableId: refTableId,
    });

    return table;
  }
}
