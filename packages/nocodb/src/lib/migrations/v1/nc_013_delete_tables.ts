import { Knex } from 'knex';

/***
 * Delete unused v2 meta tables
 *
 * "nc_cron"
 * "nc_loaders"
 * "nc_resolvers"
 * "nc_roles"
 * "nc_routes"
 * "nc_rpc"
 *
 *****/

const up = async (knex: Knex) => {
  await knex.schema.dropTableIfExists('nc_cron');
  await knex.schema.dropTableIfExists('nc_roles');
  await knex.schema.dropTableIfExists('nc_routes');
  await knex.schema.dropTableIfExists('nc_rpc');
};

const down = async (_knex: Knex) => {
  // todo: add down migration
};

export { up, down };
