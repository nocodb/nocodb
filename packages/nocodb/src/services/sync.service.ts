import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Base, SyncSource } from '~/models';

@Injectable()
export class SyncService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async syncSourceList(param: { baseId: string; sourceId?: string }) {
    return new PagedResponseImpl(
      await SyncSource.list(param.baseId, param.sourceId),
    );
  }

  async syncCreate(param: {
    baseId: string;
    sourceId?: string;
    userId: string;
    syncPayload: Partial<SyncSource>;
    req: NcRequest;
  }) {
    const base = await Base.getWithInfo(param.baseId);

    const sync = await SyncSource.insert({
      ...param.syncPayload,
      fk_user_id: param.userId,
      source_id: param.sourceId ? param.sourceId : base.sources[0].id,
      base_id: param.baseId,
    });

    this.appHooksService.emit(AppEvents.SYNC_SOURCE_CREATE, {
      syncSource: sync,
      req: param.req,
    });

    return sync;
  }

  async syncDelete(param: { syncId: string; req: NcRequest }) {
    const syncSource = await SyncSource.get(param.syncId);

    if (!syncSource) {
      NcError.badRequest('Sync source not found');
    }

    const res = await SyncSource.delete(param.syncId);

    this.appHooksService.emit(AppEvents.SYNC_SOURCE_DELETE, {
      syncSource,
      req: param.req,
    });
    return res;
  }

  async syncUpdate(param: {
    syncId: string;
    syncPayload: Partial<SyncSource>;
    req: NcRequest;
  }) {
    const syncSource = await SyncSource.get(param.syncId);

    if (!syncSource) {
      NcError.badRequest('Sync source not found');
    }

    const res = await SyncSource.update(param.syncId, param.syncPayload);

    this.appHooksService.emit(AppEvents.SYNC_SOURCE_UPDATE, {
      syncSource,

      req: param.req,
    });

    return res;
  }
}
