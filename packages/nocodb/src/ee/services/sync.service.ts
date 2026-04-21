import { Injectable } from '@nestjs/common';
import { SyncService as SyncServiceCE } from 'src/services/sync.service';
import type { NcRequest } from '~/interface/config';
import type { SyncSource } from '~/models';
import { NcContext } from '~/interface/config';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import {
  descCreate,
  descDelete,
  descUpdate,
} from '~/decorators/trace-command-descriptions';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class SyncService extends SyncServiceCE {
  @TraceCommand({
    entity: MetaTable.SYNC_SOURCE,
    entityId: 'id',
    entityTitle: (p, r) => p?.syncPayload?.title ?? r?.title,
    description: descCreate('sync source'),
    idField: 'syncPayload',
  })
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

  @TraceCommand({
    entity: MetaTable.SYNC_SOURCE,
    entityId: (p) => p?.syncId,
    entityTitle: (p) => p?.syncPayload?.title,
    description: descUpdate('sync source'),
  })
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

  @TraceCommand({
    entity: MetaTable.SYNC_SOURCE,
    entityId: (p) => p?.syncId,
    description: descDelete('sync source'),
  })
  async syncDelete(
    context: NcContext,
    param: { syncId: string; req: NcRequest },
  ) {
    return super.syncDelete(context, param);
  }
}
