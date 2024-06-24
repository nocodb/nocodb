const up = async (knex) => {
  const tablesToDrop = [
    'nc_plugins',
    'nc_disabled_models_for_role',
    'nc_shared_views',
    'nc_projects_users',
    'nc_roles',
    'nc_hooks',
    'nc_cron',
    'nc_acl',
    'nc_models',
    'nc_relations',
    'nc_routes',
    'nc_resolvers',
    'nc_loaders',
    'nc_rpc',
    'nc_audit',
    'nc_migrations',
    'nc_projects',
  ];

  // check if table exist and remove if exist
  for (const table of tablesToDrop) {
    const tableExist = await knex.schema.hasTable(table);
    if (tableExist) {
      await knex.schema.dropTable(table);
    }
  }
};

const down = async (_knex) => {};

export { up, down };
