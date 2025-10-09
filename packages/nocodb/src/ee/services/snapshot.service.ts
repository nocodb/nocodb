import { Injectable } from '@nestjs/common';
import { AppEvents, NcBaseError } from 'nocodb-sdk'
import { Logger } from '@nestjs/common';
import type { NcRequest, SnapshotType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Snapshot from '~/models/Snapshot';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class SnapshotService {
  protected logger = new Logger(SnapshotService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  async getSnapshots(context: NcContext, baseId: string) {
    return await Snapshot.list(context, baseId);
  }

  async updateSnapshot(
    context: NcContext,
    snapshotId: string,
    body: Pick<SnapshotType, 'title'>,
  ) {
    const snapshot = await Snapshot.get(context, snapshotId);

    if (!snapshot) {
      return NcError.notFound('Snapshot not found');
    }

    return await Snapshot.update(context, snapshotId, body);
  }

  async deleteSnapshot(
    context: NcContext,
    { snapshotId, req }: { baseId: string; snapshotId: string; req: NcRequest },
  ) {
    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      const snapshot = await Snapshot.get(context, snapshotId, ncMeta);

      const base = await Base.get(context, snapshot.base_id, ncMeta);

      if (!snapshot) {
        return NcError.notFound('Snapshot not found');
      }

      await Snapshot.delete(context, snapshotId, ncMeta);

      await Base.delete(
        {
          workspace_id: snapshot.fk_workspace_id,
          base_id: snapshot.snapshot_base_id,
        },
        snapshot.snapshot_base_id,
        ncMeta,
      );

      await ncMeta.commit();
      this.appHooksService.emit(AppEvents.SNAPSHOT_DELETE, {
        snapshot,
        base,
        context,
        req,
      });

      return true;
    } catch (e) {
      await ncMeta.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error('Failed to delete snapshot', e);
      NcError.get(req.context).internalServerError('Failed to delete snapshot');
    }
  }
}
