import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// UUID columns are DB-generated (gen_random_uuid()) and cannot be user-supplied.
// New UUID columns are created with `readonly = true` in the column service;
// this backfill covers columns created before that change so the generic
// col.readonly guards in BaseModelSqlv2 (insert/update) reject overrides.
const up = async (knex: Knex) => {
  await knex(MetaTable.COLUMNS).where('uidt', 'UUID').update({ readonly: true });
};

const down = async (_knex: Knex) => {
  // UUID columns are always DB-generated and read-only by design.
  // Rolling back this migration must not re-enable manual writes.
};

export { up, down };
