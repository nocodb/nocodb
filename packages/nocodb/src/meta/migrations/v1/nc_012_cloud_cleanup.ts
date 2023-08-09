const up = async (knex) => {
  await knex.schema.dropTable('nc_plugins');
  await knex.schema.dropTable('nc_disabled_models_for_role');
  await knex.schema.dropTable('nc_shared_views');
  await knex.schema.dropTable('nc_projects_users');
  await knex.schema.dropTable('nc_roles');
  await knex.schema.dropTable('nc_hooks');
  await knex.schema.dropTable('nc_cron');
  await knex.schema.dropTable('nc_acl');
  await knex.schema.dropTable('nc_models');
  await knex.schema.dropTable('nc_relations');
  await knex.schema.dropTable('nc_routes');
  await knex.schema.dropTable('nc_resolvers');
  await knex.schema.dropTable('nc_loaders');
  await knex.schema.dropTable('nc_rpc');
  await knex.schema.dropTable('nc_audit');
  await knex.schema.dropTable('nc_migrations');
  await knex.schema.dropTable('nc_projects');
};

const down = async (_knex) => {};

export { up, down };
