import { ProjectRoles } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { parseMetaProp } from '~/utils/modelUtils';

export interface BaseListAllResult {
  workspaces: {
    id: string;
    title: string;
    meta: Record<string, any>;
    bases: {
      id: string;
      title: string;
      meta: Record<string, any>;
      role: string;
      order: number;
      managed_app_master?: boolean;
      managed_app_id?: string | null;
    }[];
  }[];
}

export async function getBaseListAll(
  userId: string,
  ncMeta = Noco.ncMeta,
): Promise<BaseListAllResult> {
  const key = `${CacheScope.CMD_PALETTE}:baseListAll:${userId}`;

  let cached = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);

  if (!cached) {
    const rows = await ncMeta
      .knexConnection(`${MetaTable.PROJECT} as b`)
      .select(
        'b.id as base_id',
        'b.title as base_title',
        'b.meta as base_meta',
        'bu.roles as base_role',
        'b.order as base_order',
      )
      .innerJoin(`${MetaTable.PROJECT_USERS} as bu`, `b.id`, `bu.base_id`)
      .where('bu.fk_user_id', userId)
      .andWhereNot('bu.roles', ProjectRoles.NO_ACCESS)
      .andWhere(function () {
        this.where('b.deleted', false).orWhereNull('b.deleted');
      })
      .orderBy('b.order', 'asc');

    const bases = rows.map((row) => ({
      id: row.base_id,
      title: row.base_title,
      meta: parseMetaProp(row, 'base_meta'),
      role: row.base_role,
      order: row.base_order ?? 0,
    }));

    cached = {
      workspaces: [
        {
          id: 'nc',
          title: 'NocoDB',
          meta: {},
          bases,
        },
      ],
    };

    await NocoCache.set('root', key, cached);
    // Append to the same lists command palette uses so cleanup piggybacks
    await NocoCache.set('root', `${CacheScope.CMD_PALETTE}:ws`, [key]);
    await NocoCache.set('root', `${CacheScope.CMD_PALETTE}:user:${userId}`, [
      key,
    ]);
  }

  return cached;
}
