import { Injectable } from '@nestjs/common';
import { SyncService as SyncServiceCE } from 'src/services/sync.service';
import type { NcRequest } from '~/interface/config';
import type { SyncSource } from '~/models';
import { OperationName } from '~/command-registry/op-names';
import { NcContext } from '~/interface/config';
import { TraceCommand } from '~/decorators/trace-command.decorator';
@Injectable()
export class SyncService extends SyncServiceCE {
  @TraceCommand(OperationName.syncCreate)
  async syncCreate(
    context: NcContext,
    param: {
      baseId: string;
      sourceId?: string;
      userId: string;
      syncPayload: Partial<SyncSource>;
      req: NcRequest;
    },
  ) {
    return super.syncCreate(context, param);
  }

  @TraceCommand(OperationName.syncUpdate)
  async syncUpdate(
    context: NcContext,
    param: {
      syncId: string;
      syncPayload: Partial<SyncSource>;
      req: NcRequest;
    },
  ) {
    return super.syncUpdate(context, param);
  }

  @TraceCommand(OperationName.syncDelete)
  async syncDelete(
    context: NcContext,
    param: { syncId: string; req: NcRequest },
  ) {
    return super.syncDelete(context, param);
  }
}
