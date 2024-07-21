import type { NcContext } from '~/interface/config';
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
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  fk_user_id?: string;

  constructor(syncSource: Partial<SyncSource>) {
    Object.assign(this, syncSource);
  }

  public getUser(ncMeta = Noco.ncMeta) {
    return User.get(this.fk_user_id, ncMeta);
  }

  public static async get(
    context: NcContext,
    syncSourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const syncSource = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
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

  static async list(
    context: NcContext,
    baseId: string,
    sourceId?: string,
    ncMeta = Noco.ncMeta,
  ) {
    const condition = sourceId
      ? { base_id: baseId, source_id: sourceId }
      : { base_id: baseId };
    const syncSources = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
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
    context: NcContext,
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
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
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
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      updateObj,
      syncSourceId,
    );

    return this.get(context, syncSourceId, ncMeta);
  }

  static async delete(
    context: NcContext,
    syncSourceId: any,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      syncSourceId,
    );
  }

  static async deleteByUserId(userId: string, ncMeta = Noco.ncMeta) {
    if (!userId) NcError.badRequest('User Id is required');

    return await ncMeta
      .knex(MetaTable.SYNC_SOURCE)
      .where({
        fk_user_id: userId,
      })
      .del();
  }
}
