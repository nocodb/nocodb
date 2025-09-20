import { PlanLimitTypes, type SnapshotType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb } from '~/utils/modelUtils';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';

export default class Snapshot implements SnapshotType {
  id?: string;
  title?: string;
  base_id?: string;

  snapshot_base_id?: string;
  fk_workspace_id?: string;
  created_by?: string;
  status?: string;

  created_at?: string;
  updated_at?: string;

  constructor(snapshot: Snapshot | SnapshotType) {
    Object.assign(this, snapshot);
  }

  public static async get(
    context: NcContext,
    snapshotId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let snapshot = await NocoCache.get(
      context,
      `${CacheScope.SNAPSHOT}:${snapshotId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!snapshot) {
      snapshot = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.SNAPSHOT,
        snapshotId,
      );

      if (snapshot) {
        NocoCache.set(
          context,
          `${CacheScope.SNAPSHOT}:${snapshotId}`,
          snapshot,
        );
      }
    }

    return snapshot && new Snapshot(snapshot);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(context, CacheScope.SNAPSHOT, [
      baseId,
    ]);

    let { list: snapshotList } = cachedList;

    if (!cachedList.isNoneList && !snapshotList.length) {
      snapshotList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.SNAPSHOT,
        {
          condition: {
            base_id: baseId,
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      );
      NocoCache.setList(context, CacheScope.SNAPSHOT, [baseId], snapshotList);
    }

    return snapshotList.map((snapshot) => new Snapshot(snapshot));
  }

  public static async insert(
    context: NcContext,
    snapshot: Partial<SnapshotType>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(snapshot, [
      'title',
      'base_id',
      'fk_workspace_id',
      'created_by',
      'status',
      'snapshot_base_id',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SNAPSHOT,
      insertObj,
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE,
      1,
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        context,
        CacheScope.SNAPSHOT,
        [snapshot.base_id],
        `${CacheScope.SNAPSHOT}:${id}`,
      );
      return res;
    });
  }

  public static async update(
    context: NcContext,
    snapshotId: string,
    snapshot: Partial<Snapshot>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(snapshot, ['title', 'status']);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SNAPSHOT,
      prepareForDb(updateObj),
      snapshotId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.SNAPSHOT}:${snapshotId}`,
      updateObj,
    );

    return this.get(context, snapshotId, ncMeta);
  }

  static async delete(
    context: NcContext,
    snapshotId: any,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SNAPSHOT,
      snapshotId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.SNAPSHOT}:${snapshotId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE,
      -1,
    );

    return res;
  }
}
