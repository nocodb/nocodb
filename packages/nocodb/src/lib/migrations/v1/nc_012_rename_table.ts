import { Knex } from 'knex';

/***
 * Rename v2 meta tables
 *
 * "nc_acl" => "z_acl"
 * "nc_audit" => "z_audit"
 * "nc_disabled_models_for_role" => "z_disabled_models_for_role"
 * "nc_hooks" => "z_hooks"
 * "nc_migrations" => "z_migrations"
 * "nc_models" => "z_models"
 * "nc_plugins" => "z_plugins"
 * "nc_projects" => "z_projects"
 * "nc_projects_users" => "z_projects_users"
 * "nc_relations" => "z_relations"
 * "nc_shared_bases" => "z_shared_bases"
 * "nc_shared_views" => "z_shared_views"
 *
 *****/

const up = async (knex: Knex) => {
  await knex.schema.renameTable('nc_acl', 'z_acl');
  await knex.schema.renameTable('nc_audit', 'z_audit');
  await knex.schema.renameTable(
    'nc_disabled_models_for_role',
    'z_disabled_models_for_role'
  );
  await knex.schema.renameTable('nc_hooks', 'z_hooks');
  await knex.schema.renameTable('nc_migrations', 'z_migrations');
  await knex.schema.renameTable('nc_models', 'z_models');
  await knex.schema.renameTable('nc_plugins', 'z_plugins');
  await knex.schema.renameTable('nc_projects', 'z_projects');
  await knex.schema.renameTable('nc_projects_users', 'z_projects_users');
  await knex.schema.renameTable('nc_relations', 'z_relations');
  await knex.schema.renameTable('nc_shared_bases', 'z_shared_bases');
  await knex.schema.renameTable('nc_shared_views', 'z_shared_views');
};

const down = async (knex: Knex) => {
  await knex.schema.renameTable('z_acl', 'nc_acl');
  await knex.schema.renameTable('z_audit', 'nc_audit');
  await knex.schema.renameTable(
    'z_disabled_models_for_role',
    'nc_disabled_models_for_role'
  );
  await knex.schema.renameTable('z_hooks', 'nc_hooks');
  await knex.schema.renameTable('z_migrations', 'nc_migrations');
  await knex.schema.renameTable('z_models', 'nc_models');
  await knex.schema.renameTable('z_plugins', 'nc_plugins');
  await knex.schema.renameTable('z_projects', 'nc_projects');
  await knex.schema.renameTable('z_projects_users', 'nc_projects_users');
  await knex.schema.renameTable('z_relations', 'nc_relations');
  await knex.schema.renameTable('z_shared_bases', 'nc_shared_bases');
  await knex.schema.renameTable('z_shared_views', 'nc_shared_views');
};

export { up, down };
