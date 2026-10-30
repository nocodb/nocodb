import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Base, SyncSource } from '~/models';
import { maskSyncDetails, SYNC_SECRET_MASK } from '~/models/SyncSource';

const maskDetails = (sync: SyncSource) => {
  if (sync?.details?.apiKey) {
    sync.details = maskSyncDetails(sync.details);
  }
  return sync;
};

@Injectable()
export class SyncService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async syncSourceList(
    context: NcContext,
    param: { baseId: string; sourceId?: string },
  ) {
    const list = await SyncSource.list(context, param.baseId, param.sourceId);

    return new PagedResponseImpl(list.map(maskDetails));
  }

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
    const base = await Base.getWithInfo(context, param.baseId);

    const sync = await SyncSource.insert(context, {
      ...param.syncPayload,
      fk_user_id: param.userId,
      source_id: param.sourceId ? param.sourceId : base.sources[0].id,
      base_id: param.baseId,
    });

    this.appHooksService.emit(AppEvents.SYNC_SOURCE_CREATE, {
      syncSource: maskDetails(new SyncSource({ ...sync })),
      req: param.req,
      context,
    });

    return maskDetails(new SyncSource({ ...sync }));
  }

  async syncDelete(
    context: NcContext,
    param: { syncId: string; req: NcRequest },
  ) {
    const syncSource = await SyncSource.get(context, param.syncId);

    if (!syncSource) {
      NcError.get(context).badRequest('Sync source not found');
    }

    const res = await SyncSource.delete(context, param.syncId);

    this.appHooksService.emit(AppEvents.SYNC_SOURCE_DELETE, {
      syncSource: maskDetails(new SyncSource({ ...syncSource })),
      req: param.req,
      context,
    });
    return res;
  }

  async syncUpdate(
    context: NcContext,
    param: {
      syncId: string;
      syncPayload: Partial<SyncSource>;
      req: NcRequest;
    },
  ) {
    const syncSource = await SyncSource.get(context, param.syncId);

    if (!syncSource) {
      NcError.get(context).badRequest('Sync source not found');
    }

    let syncPayload = param.syncPayload;

    if (syncPayload?.details?.apiKey === SYNC_SECRET_MASK) {
      syncPayload = {
        ...syncPayload,
        details: { ...syncPayload.details, apiKey: syncSource.details?.apiKey },
      };
    }

    const res = await SyncSource.update(context, param.syncId, syncPayload);

    this.appHooksService.emit(AppEvents.SYNC_SOURCE_UPDATE, {
      syncSource: maskDetails(new SyncSource({ ...syncSource })),
      req: param.req,
      context,
    });

    return maskDetails(res);
  }
}
