import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { TableSyncService } from '~/modules/table-sync/table-sync.service';

@Injectable()
export class TableSyncPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(private readonly tableSyncService: TableSyncService) {}

  operations = [
    'tableSyncCreate' as const,
    'tableSyncUpdate' as const,
    'tableSyncDelete' as const,
    'tableSyncResync' as const,
    'tableSyncFreeze' as const,
    'tableSyncResume' as const,
    'tableSyncResolveLink' as const,
    'tableSyncDetachTable' as const,
  ];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
      payload,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload?: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    const syncId = req.query.tableSyncId as string;

    switch (operation) {
      case 'tableSyncCreate':
        return await this.tableSyncService.createSync(context, {
          body: payload,
          req,
        });

      case 'tableSyncUpdate':
        return await this.tableSyncService.updateSync(context, {
          syncId,
          body: payload,
          req,
        });

      case 'tableSyncDelete':
        return await this.tableSyncService.delete(context, {
          syncId,
          req,
          dropTables: !!payload?.dropTables,
        });

      case 'tableSyncResync':
        return await this.tableSyncService.manualResync(context, {
          syncId,
          req,
        });

      case 'tableSyncFreeze':
        return await this.tableSyncService.freezeSync(context, {
          syncId,
          req,
        });

      case 'tableSyncResume':
        return await this.tableSyncService.resumeSync(context, {
          syncId,
          req,
        });

      case 'tableSyncResolveLink':
        return await this.tableSyncService.resolveLink(context, payload);

      case 'tableSyncDetachTable':
        return await this.tableSyncService.detachTable(context, {
          modelId: payload?.modelId,
          req,
        });
    }
  }
}
