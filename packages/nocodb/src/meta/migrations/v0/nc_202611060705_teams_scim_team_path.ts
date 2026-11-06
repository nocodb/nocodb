import type { Knex } from 'knex';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

// SCIM created teams without a hierarchy path or meta, so their workspace and
// base roles never applied. SCIM teams are always root teams.
const up = async (knex: Knex) => {
  const ids: string[] = await knex(MetaTable.TEAMS)
    .where('scim_managed', true)
    .where((qb) => qb.whereNull('path').orWhereNull('meta'))
    .pluck('id');

  if (!ids.length) return;

  const client = (knex.client.config.client as string) ?? '';
  const pathExpr = ['mysql', 'mysql2'].includes(client)
    ? knex.raw("CONCAT('/', id)")
    : knex.raw("'/' || id");

  await knex(MetaTable.TEAMS)
    .whereIn('id', ids)
    .whereNull('path')
    .whereNull('fk_parent_team_id')
    .update({ path: pathExpr, depth: 0 });

  await knex(MetaTable.TEAMS)
    .whereIn('id', ids)
    .whereNull('meta')
    .update({ meta: '{}' });

  // Knex migrations don't flush the cache; cached teams would keep the null path.
  await NocoCache.del(
    'root',
    ids.map((id) => `${CacheScope.TEAM}:${id}`),
  );
};

const down = async (_knex: Knex) => {
  // Backfill only; nothing to undo
};

export { up, down };
