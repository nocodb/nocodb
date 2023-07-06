const up = async (knex) => {



  await knex.schema.createTable('nc_store', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('key').index();
    table.text('value', 'text');
    table.string('type');
    table.string('env');
    table.string('tag');
    table.timestamps();
  });

  await knex('nc_store').insert({
    key: 'NC_DEBUG',
    value: JSON.stringify({
      'nc:app': false,
      'nc:api:rest': false,
      'nc:api:base': false,
      'nc:api:gql': false,
      'nc:api:grpc': false,
      'nc:migrator': false,
      'nc:datamapper': false,
    }),
    db_alias: '',
  });

  await knex('nc_store').insert({
    key: 'NC_PROJECT_COUNT',
    value: '0',
    db_alias: '',
  });

  await knex.schema.createTable('nc_api_tokens', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias');
    table.string('description');
    table.text('permissions');
    table.text('token');
    table.string('expiry');
    table.boolean('enabled').defaultTo(true);
    table.timestamps();
  });
};

const down = async (knex) => {
  await knex.schema.dropTable('nc_store');
  await knex.schema.dropTable('nc_api_tokens');
};

export { up, down };
