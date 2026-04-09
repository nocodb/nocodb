import {
  ProjectRoles,
  WorkspaceRolesToProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import type { PlanTitles } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { parseMetaProp } from '~/utils/modelUtils';

export interface BaseListAllResult {
  workspaces: {
    id: string;
    title: string;
    meta: Record<string, any>;
    plan_title: PlanTitles | null;
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
      .knexConnection(`${MetaTable.WORKSPACE} as ws`)
      .select(
        'ws.id as workspace_id',
        'ws.title as workspace_title',
        'ws.meta as workspace_meta',
        'p.title as plan_title',
        'b.id as base_id',
        'b.title as base_title',
        'b.meta as base_meta',
        ncMeta.knexConnection.raw(`CASE
          WHEN "bu"."roles" is not null THEN "bu"."roles"
          ${Object.values(WorkspaceUserRoles)
            .map(
              (value) =>
                `WHEN "wu"."roles" = '${value}' THEN '${WorkspaceRolesToProjectRoles[value]}'`,
            )
            .join(' ')}
          ELSE '${ProjectRoles.NO_ACCESS}'
          END as base_role`),
        'b.order as base_order',
        'b.managed_app_master as base_managed_app_master',
        'b.managed_app_id as base_managed_app_id',
      )
      .innerJoin(
        `${MetaTable.WORKSPACE_USER} as wu`,
        `wu.fk_workspace_id`,
        `ws.id`,
      )
      .innerJoin(`${MetaTable.PROJECT} as b`, `b.fk_workspace_id`, `ws.id`)
      .leftJoin(`${MetaTable.PROJECT_USERS} as bu`, function () {
        this.on(`bu.base_id`, `=`, `b.id`).andOn(
          `bu.fk_user_id`,
          `=`,
          `wu.fk_user_id`,
        );
      })
      .leftJoin(`${MetaTable.SUBSCRIPTIONS} as sub`, function () {
        this.on(function () {
          this.on(`sub.fk_workspace_id`, `=`, `ws.id`).orOn(
            `sub.fk_org_id`,
            `=`,
            `ws.fk_org_id`,
          );
        }).andOnIn(`sub.status`, [
          'active',
          'trialing',
          'incomplete',
          'past_due',
        ]);
      })
      .leftJoin(`${MetaTable.PLANS} as p`, `p.id`, `sub.fk_plan_id`)
      .where('wu.fk_user_id', userId)
      .andWhere(function () {
        this.where('ws.deleted', false).orWhereNull('ws.deleted');
      })
      .andWhere(function () {
        this.where(function () {
          this.where('b.deleted', false).orWhereNull('b.deleted');
        });
        this.where(function () {
          this.where('b.is_snapshot', false).orWhereNull('b.is_snapshot');
        });
      })
      .orderBy([
        { column: 'ws.title', order: 'asc' },
        { column: 'b.order', order: 'asc' },
      ]);

    // Filter NO_ACCESS bases and group by workspace
    const wsMap = new Map<string, BaseListAllResult['workspaces'][number]>();

    for (const row of rows) {
      if (row.base_role === ProjectRoles.NO_ACCESS) continue;

      let ws = wsMap.get(row.workspace_id);
      if (!ws) {
        ws = {
          id: row.workspace_id,
          title: row.workspace_title,
          meta: parseMetaProp(row, 'workspace_meta'),
          plan_title: row.plan_title ?? null,
          bases: [],
        };
        wsMap.set(row.workspace_id, ws);
      }

      ws.bases.push({
        id: row.base_id,
        title: row.base_title,
        meta: parseMetaProp(row, 'base_meta'),
        role: row.base_role,
        order: row.base_order ?? 0,
        managed_app_master: row.base_managed_app_master,
        managed_app_id: row.base_managed_app_id,
      });
    }

    cached = {
      workspaces: Array.from(wsMap.values()),
    };

    await NocoCache.set('root', key, cached);

    // Register in every workspace's list so any workspace change invalidates this cache.
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
