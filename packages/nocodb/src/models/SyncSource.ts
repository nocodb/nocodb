import User from '~/models/User';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';

export default class SyncSource {
  id?: string;
  title?: string;
  type?: string;
  details?: any;
  deleted?: boolean;
  order?: number;
  base_id?: string;
  source_id?: string;
  fk_user_id?: string;

  constructor(syncSource: Partial<SyncSource>) {
    Object.assign(this, syncSource);
  }

  public getUser(ncMeta = Noco.ncMeta) {
    return User.get(this.fk_user_id, ncMeta);
  }

  public static async get(syncSourceId: string, ncMeta = Noco.ncMeta) {
    const syncSource = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.SYNC_SOURCE,
      syncSourceId,
    );
    if (syncSource.details && typeof syncSource.details === 'string') {
      try {
        syncSource.details = JSON.parse(syncSource.details);
      } catch {}
    }
    return syncSource && new SyncSource(syncSource);
  }

  static async list(baseId: string, sourceId?: string, ncMeta = Noco.ncMeta) {
    const condition = sourceId
      ? { base_id: baseId, source_id: sourceId }
      : { base_id: baseId };
    const syncSources = await ncMeta.metaList(
      null,
      null,
      MetaTable.SYNC_SOURCE,
      {
        condition,
        orderBy: {
          created_at: 'asc',
        },
      },
    );

    for (const syncSource of syncSources) {
      if (syncSource.details && typeof syncSource.details === 'string') {
        try {
          syncSource.details = JSON.parse(syncSource.details);
        } catch {}
      }
    }
    return syncSources?.map((h) => new SyncSource(h));
  }

  public static async insert(
    syncSource: Partial<SyncSource>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(syncSource, [
      'id',
      'title',
      'type',
      'details',
      'base_id',
      'source_id',
      'fk_user_id',
    ]);

    if (insertObj.details && typeof insertObj.details === 'object') {
      insertObj.details = JSON.stringify(insertObj.details);
    }

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.SYNC_SOURCE,
      insertObj,
    );

    return this.get(id, ncMeta);
  }

  public static async update(
    syncSourceId: string,
    syncSource: Partial<SyncSource>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(syncSource, [
      'id',
      'title',
      'type',
      'details',
      'deleted',
      'order',
      'base_id',
      'source_id',
    ]);

    if (updateObj.details && typeof updateObj.details === 'object') {
      updateObj.details = JSON.stringify(updateObj.details);
    }

    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.SYNC_SOURCE,
      updateObj,
      syncSourceId,
    );

    return this.get(syncSourceId, ncMeta);
  }

  static async delete(syncSourceId: any, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaDelete(
      null,
      null,
      MetaTable.SYNC_SOURCE,
      syncSourceId,
    );
  }

  static async deleteByUserId(userId: string, ncMeta = Noco.ncMeta) {
    if (!userId) NcError.badRequest('User Id is required');

    return await ncMeta.metaDelete(null, null, MetaTable.SYNC_SOURCE, {
      fk_user_id: userId,
    });
  }
}
