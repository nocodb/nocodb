import {
  ProjectRoles,
  WorkspaceRolesToProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

export async function getCommandPaletteForUserWorkspace(
  userId: string,
  workspaceId: string,
  ncMeta = Noco.ncMeta,
) {
  const key = `${CacheScope.CMD_PALETTE}:${userId}:${workspaceId}`;

  let cmdData = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

  if (!cmdData) {
    const rootQb = ncMeta
      .knexConnection(`${MetaTable.WORKSPACE} as ws`)
      .select(
        'ws.id as workspace_id',
        'ws.title as workspace_title',
        'ws.meta as workspace_meta',
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
      .where('ws.id', workspaceId)
      .andWhere('wu.fk_user_id', userId)
      .andWhere(function () {
        this.where('ws.deleted', false).orWhereNull('ws.deleted');
      })
      .andWhere(function () {
        this.where('b.deleted', false).orWhereNull('b.deleted');
      });

    const qb = ncMeta.knexConnection
      .select(
        'root.workspace_id as workspace_id',
        'root.workspace_title as workspace_title',
        'root.workspace_meta as workspace_meta',
        'root.base_id as base_id',
        'root.base_title as base_title',
        'root.base_meta as base_meta',
        'root.base_role as base_role',
        'root.base_order as base_order',
        't.id as table_id',
        't.title as table_title',
        't.type as table_type',
        't.meta as table_meta',
        't.order as table_order',
        'v.id as view_id',
        'v.title as view_title',
        'v.is_default as view_is_default',
        'v.type as view_type',
        'v.meta as view_meta',
        'v.order as view_order',
        'dm.disabled',
      )
      .from(rootQb.as('root'))
      .innerJoin(`${MetaTable.MODELS} as t`, `t.base_id`, `root.base_id`)
      .innerJoin(`${MetaTable.VIEWS} as v`, `v.fk_model_id`, `t.id`)
      .leftJoin(`${MetaTable.MODEL_ROLE_VISIBILITY} as dm`, function () {
        this.on(`dm.fk_view_id`, `=`, `v.id`).andOn(
          `dm.role`,
          `=`,
          `root.base_role`,
        );
      })
      .where(function () {
        this.where('t.mm', false).orWhereNull('t.mm');
      })
      .andWhere(function () {
        this.where('t.deleted', false).orWhereNull('t.deleted');
      })
      .andWhere(function () {
        this.where('dm.disabled', false).orWhereNull('dm.disabled');
      })
      .andWhereNot(function () {
        this.where('root.base_role', ProjectRoles.NO_ACCESS).orWhereNull(
          'root.base_role',
        );
      });

    cmdData = {
      data: await qb,
    };

    await NocoCache.set(key, cmdData);
    // append to lists for later cleanup
    await NocoCache.set(`${CacheScope.CMD_PALETTE}:ws:${workspaceId}`, [key]);
    await NocoCache.set(`${CacheScope.CMD_PALETTE}:user:${userId}`, [key]);
  }

  // order by base_order, table_order, view_order
  return cmdData?.data?.sort((a, b) => {
    if (a.base_order !== b.base_order) {
      return (a.base_order ?? Infinity) - (b.base_order ?? Infinity);
    }
    if (a.table_order !== b.table_order) {
      return (a.table_order ?? Infinity) - (b.table_order ?? Infinity);
    }
    if (a.view_order !== b.view_order) {
      return (a.view_order ?? Infinity) - (b.view_order ?? Infinity);
    }
    return 0;
  });
}

export async function cleanCommandPaletteCache(workspaceId: string) {
  const keys = await NocoCache.get(
    `${CacheScope.CMD_PALETTE}:ws:${workspaceId}`,
    CacheGetType.TYPE_ARRAY,
  );

  if (keys) {
    await NocoCache.del([...keys, `${CacheScope.CMD_PALETTE}:${workspaceId}`]);
  }
}

export async function cleanCommandPaletteCacheForUser(userId: string) {
  const keys = await NocoCache.get(
    `${CacheScope.CMD_PALETTE}:user:${userId}`,
    CacheGetType.TYPE_ARRAY,
  );

  if (keys) {
    await NocoCache.del([...keys, `${CacheScope.CMD_PALETTE}:${userId}`]);
  }
}
