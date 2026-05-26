import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import type TableSync from '~/models/TableSync';
import { TableSyncService } from '~/modules/table-sync/table-sync.service';

const sanitizeSync = (sync: TableSync | null) => {
  if (!sync) return sync;
  return {
    ...sync,
    mappings: (sync.mappings ?? []).map((m) => {
      const { source_password_hash: _drop, ...rest } = m;
      return { ...rest, has_source_password: !!m.source_password_hash };
    }),
  };
};

@Injectable()
export class TableSyncGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(private readonly tableSyncService: TableSyncService) {}

  operations = ['tableSyncList' as const, 'tableSyncGet' as const];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'tableSyncList': {
        const syncs = await this.tableSyncService.list(context);
        return syncs.map((s) => sanitizeSync(s));
      }

      case 'tableSyncGet':
        return sanitizeSync(
          await this.tableSyncService.get(context, {
            syncId: req.query.tableSyncId as string,
          }),
        );
    }
  }
}
