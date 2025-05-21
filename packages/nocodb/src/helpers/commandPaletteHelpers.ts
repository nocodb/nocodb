import { ProjectRoles } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

export async function getCommandPaletteForUserWorkspace(
  userId: string,
  workspaceId: string = 'nc',
  ncMeta = Noco.ncMeta,
) {
  const key = `${CacheScope.CMD_PALETTE}:${userId}:${workspaceId}`;

  let cmdData = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

  if (!cmdData) {
    cmdData = {
      data: await ncMeta
        .knexConnection(`${MetaTable.PROJECT} as b`)
        .select(
          'b.id as base_id',
          'b.title as base_title',
          'b.meta as base_meta',
          'b.order as base_order',
          'bu.roles as base_role',
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
        .innerJoin(`${MetaTable.PROJECT_USERS} as bu`, `b.id`, `bu.base_id`)
        .innerJoin(`${MetaTable.MODELS} as t`, `t.base_id`, `b.id`)
        .innerJoin(`${MetaTable.VIEWS} as v`, `v.fk_model_id`, `t.id`)
        .leftJoin(`${MetaTable.MODEL_ROLE_VISIBILITY} as dm`, function () {
          this.on(`dm.fk_view_id`, `=`, `v.id`).andOn(
            `dm.role`,
            `=`,
            `bu.roles`,
          );
        })
        .where('bu.fk_user_id', userId)
        .andWhereNot('bu.roles', ProjectRoles.NO_ACCESS)
        .andWhere('t.mm', false)
        .andWhere(function () {
          this.where('dm.disabled', false).orWhereNull('dm.disabled');
        })
        .andWhere(function () {
          this.where('b.deleted', false).orWhereNull('b.deleted');
        })
        .andWhere(function () {
          this.where('t.deleted', false).orWhereNull('t.deleted');
        }),
    };

    await NocoCache.set(key, cmdData);
    // append to lists for later cleanup
    await NocoCache.set(`${CacheScope.CMD_PALETTE}:ws`, [key]);
    await NocoCache.set(`${CacheScope.CMD_PALETTE}:user:${userId}`, [key]);
  }

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

export async function cleanCommandPaletteCache(_ws?: string) {
  const keys = await NocoCache.get(
    `${CacheScope.CMD_PALETTE}:ws`,
    CacheGetType.TYPE_ARRAY,
  );

  if (keys) {
    await NocoCache.del([...keys, `${CacheScope.CMD_PALETTE}`]);
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
