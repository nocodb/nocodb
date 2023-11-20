import { CacheGetType, CacheScope, MetaTable } from './globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

export default async function (force = false, ncMeta = Noco.ncMeta) {
  try {
    let res = await NocoCache.get(
      CacheScope.INSTANCE_META,
      CacheGetType.TYPE_OBJECT,
    );
    if (!res || force) {
      const projectsMeta = await ncMeta
        .knex(MetaTable.PROJECT)
        .count('id as count')
        .first()
        .where('deleted', false)
        .where('is_meta', true)
        .then((c) => c.count);
      const projectsExt = await ncMeta
        .knex(MetaTable.PROJECT)
        .count('id as count')
        .first()
        .where('deleted', false)
        .where('is_meta', false)
        .then((c) => c.count);
      const impacted = await ncMeta
        .knex(MetaTable.USERS)
        .count('id as count')
        .first()
        .then((c) => c.count);
      const created = await ncMeta
        .knex('nc_store')
        .select('created_at')
        .where('key', 'nc_server_id')
        .first()
        .then((c) => c.created_at);

      const nc_db_type = Noco.getConfig()?.meta?.db?.client;

      res = { projectsMeta, projectsExt, impacted, nc_db_type, created };
      await NocoCache.set(CacheScope.INSTANCE_META, res);
    }
    return res;
  } catch {
    return {};
  }
}
