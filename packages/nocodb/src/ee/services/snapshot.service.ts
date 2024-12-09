import { Injectable } from '@nestjs/common';
import type { SnapshotType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Snapshot from '~/models/Snapshot';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';
import Noco from '~/Noco';

@Injectable()
export class SnapshotService {
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

  async deleteSnapshot(context: NcContext, baseId: string, snapshotId: string) {
    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      const snapshot = await Snapshot.get(context, snapshotId, ncMeta);

      if (!snapshot) {
        return NcError.notFound('Snapshot not found');
      }

      await Snapshot.delete(context, snapshotId, ncMeta);

      await Base.delete({
        workspace_id: snapshot.fk_workspace_id,
        base_id: snapshot.snapshot_base_id,
      }, snapshot.snapshot_base_id, ncMeta);

      await ncMeta.commit();

      return true;

    } catch (e) {
      await ncMeta.rollback();
      throw e;
    }
  }
}
