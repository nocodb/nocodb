import { extractRolesObj, OrgUserRoles, ProjectRoles } from 'nocodb-sdk';
import { getBaseListAll as getBaseListAllEE } from 'src/ee/helpers/baseListAllHelpers';
import type { BaseListAllResult } from 'src/ee/helpers/baseListAllHelpers';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { User } from '~/models';
import { parseMetaProp } from '~/utils/modelUtils';

export { BaseListAllResult };

export async function getBaseListAll(
  userId: string,
  ncMeta = Noco.ncMeta,
): Promise<BaseListAllResult> {
  const user = await User.get(userId, ncMeta);

  if (!user || !extractRolesObj(user.roles)?.[OrgUserRoles.SUPER_ADMIN]) {
    return getBaseListAllEE(userId, ncMeta);
  }

  // Super admin: return ALL workspaces and ALL bases with owner role
  const key = `${CacheScope.CMD_PALETTE}:baseListAll:${userId}`;

  let cached = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);

  if (!cached) {
    const rows = await ncMeta
      .knexConnection(`${MetaTable.WORKSPACE} as ws`)
      .select(
        'ws.id as workspace_id',
        'ws.title as workspace_title',
        'ws.meta as workspace_meta',
        'b.id as base_id',
        'b.title as base_title',
        'b.meta as base_meta',
        'b.order as base_order',
        'b.managed_app_master as base_managed_app_master',
        'b.managed_app_id as base_managed_app_id',
      )
      .innerJoin(`${MetaTable.PROJECT} as b`, `b.fk_workspace_id`, `ws.id`)
      .andWhere(function () {
        this.where('ws.deleted', false).orWhereNull('ws.deleted');
      })
      .andWhere(function () {
        this.where('b.deleted', false).orWhereNull('b.deleted');
        this.andWhere('b.is_snapshot', false).orWhereNull('b.is_snapshot');
      })
      .orderBy([
        { column: 'ws.title', order: 'asc' },
        { column: 'b.order', order: 'asc' },
      ]);

    const wsMap = new Map<string, BaseListAllResult['workspaces'][number]>();

    for (const row of rows) {
      let ws = wsMap.get(row.workspace_id);
      if (!ws) {
        ws = {
          id: row.workspace_id,
          title: row.workspace_title,
          meta: parseMetaProp(row, 'workspace_meta'),
          plan_title: null,
          bases: [],
        };
        wsMap.set(row.workspace_id, ws);
      }

      ws.bases.push({
        id: row.base_id,
        title: row.base_title,
        meta: parseMetaProp(row, 'base_meta'),
        role: ProjectRoles.OWNER,
        order: row.base_order ?? 0,
        managed_app_master: row.base_managed_app_master,
        managed_app_id: row.base_managed_app_id,
      });
    }

    cached = {
      workspaces: Array.from(wsMap.values()),
    };

    await NocoCache.set('root', key, cached);
    for (const wsId of wsMap.keys()) {
      await NocoCache.set('root', `${CacheScope.CMD_PALETTE}:ws:${wsId}`, [
        key,
      ]);
    }
    await NocoCache.set('root', `${CacheScope.CMD_PALETTE}:user:${userId}`, [
      key,
    ]);
  }

  return cached;
}
