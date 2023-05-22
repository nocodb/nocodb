import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents } from 'nocodb-sdk';
import { NcError } from '../helpers/catchError';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { Project, SyncSource } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';

@Injectable()
export class SyncService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async syncSourceList(param: { projectId: string; baseId?: string }) {
    return new PagedResponseImpl(
      await SyncSource.list(param.projectId, param.baseId),
    );
  }

  async syncCreate(param: {
    projectId: string;
    baseId?: string;
    userId: string;
    syncPayload: Partial<SyncSource>;
  }) {
    const project = await Project.getWithInfo(param.projectId);

    const sync = await SyncSource.insert({
      ...param.syncPayload,
      fk_user_id: param.userId,
      base_id: param.baseId ? param.baseId : project.bases[0].id,
      project_id: param.projectId,
    });

    this.appHooksService.emit(AppEvents.SYNC_SOURCE_CREATE, {
      syncSource: sync,
    });

    return sync;
  }

  async syncDelete(param: { syncId: string }) {
    const syncSource = await SyncSource.get(param.syncId);

    if (!syncSource) {
      NcError.badRequest('Sync source not found');
    }

    const res = await SyncSource.delete(param.syncId);

    this.appHooksService.emit(AppEvents.SYNC_SOURCE_DELETE, {
      syncSource,
    });
    return res;
  }

  async syncUpdate(param: {
    syncId: string;
    syncPayload: Partial<SyncSource>;
  }) {
    const syncSource = await SyncSource.get(param.syncId);

    if (!syncSource) {
      NcError.badRequest('Sync source not found');
    }

    const res = await SyncSource.update(param.syncId, param.syncPayload);

    this.appHooksService.emit(AppEvents.SYNC_SOURCE_UPDATE, {
      syncSource,
    });

    return res;
  }
}
