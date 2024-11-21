import { Injectable } from '@nestjs/common';
import type { SnapshotType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Snapshot from '~/models/Snapshot';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';

@Injectable()
export class SnapshotService {
  async getSnapshots(context: NcContext, baseId: string) {
    return await Snapshot.list(context, baseId);
  }

  async createSnapshot() {
    // TODO: Implement restoreSnapshot
    return {};
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

  async restoreSnapshot(_context: NcContext, _snapshotId: string) {
    // TODO: Implement restoreSnapshot
    return {};
  }

  async deleteSnapshot(context: NcContext, baseId: string, snapshotId: string) {
    const snapshot = await Snapshot.get(context, snapshotId);

    if (!snapshot) {
      return NcError.notFound('Snapshot not found');
    }

    await Snapshot.delete(context, snapshotId);

    await Base.softDelete(context, baseId);

    return true;
  }
}
