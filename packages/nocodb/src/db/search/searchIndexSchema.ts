import type { Knex } from 'knex';

/** Side tables live per base, out of the base schema that data reflection grants. */
export function searchSchemaName(baseId: string) {
  return `nc_search_${baseId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
}

export async function dropSearchSchema(knex: Knex, baseId: string) {
  await knex.raw(`DROP SCHEMA IF EXISTS ?? CASCADE`, [
    searchSchemaName(baseId),
  ]);
}
