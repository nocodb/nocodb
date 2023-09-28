// import cache from '../../v1-legacy/plugins/cache';
// import googleAuth from '../../v1-legacy/plugins/googleAuth';
// import ses from '../../v1-legacy/plugins/ses';

const up = async (knex) => {
  await knex.schema.createTable('nc_projects', (table) => {
    table.string('id', 128).primary();
    table.string('title');
    table.string('status');
    table.text('description');
    table.text('config');
    table.text('meta');
    table.timestamps();
  });

  await knex.schema.createTable('nc_roles', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('title');
    table.string('type').defaultTo('CUSTOM');
    table.string('description');
    table.timestamps();
  });

  await knex('nc_roles').insert([
    {
      db_alias: '',
      project_id: '',
      title: 'owner',
      description:
        'Can add/remove creators. And full edit database structures & fields.',
      type: 'SYSTEM',
    },
    {
      db_alias: '',
      project_id: '',
      title: 'creator',
      description: 'Can fully edit database structure & values',
      type: 'SYSTEM',
    },
    {
      db_alias: '',
      project_id: '',
      title: 'editor',
      description:
        'Can edit records but cannot change structure of database/fields',
      type: 'SYSTEM',
    },
    {
      db_alias: '',
      project_id: '',
      title: 'commenter',
      description: 'Can view and comment the records but cannot edit anything',
      type: 'SYSTEM',
    },
    {
      db_alias: '',
      project_id: '',
      title: 'viewer',
      description: 'Can view the records but cannot edit anything',
      type: 'SYSTEM',
    },
    // {
    //   db_alias: '',
    //   project_id: '',
    //   title: 'guest',
    //   description: 'API access for an unauthorized user',
    //   type: 'SYSTEM'
    // },
  ]);

  await knex.schema.createTable('nc_hooks', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('title');
    table.string('description', 255);
    table.string('env').defaultTo('all');
    table.string('tn');
    table.string('type');
    table.string('event');

    table.string('operation');
    table.boolean('async').defaultTo(false);
    table.boolean('payload').defaultTo(true);

    table.text('url', 'text');
    table.text('headers', 'text');

    table.text('condition', 'text');
    table.text('notification', 'text');

    table.integer('retries').defaultTo(0);
    table.integer('retry_interval').defaultTo(60000);
    table.integer('timeout').defaultTo(60000);
    table.boolean('active').defaultTo(true);

    table.timestamps();
  });

  await knex('nc_hooks').insert({
    // url: 'http://localhost:4000/auth/hook',
    type: 'AUTH_MIDDLEWARE',
  });

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
      'nc:api:source': false,
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

  await knex.schema.createTable('nc_cron', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('title');
    table.string('description', 255);
    table.string('env');
    table.string('pattern');
    table.string('webhook');
    table.string('timezone').defaultTo('America/Los_Angeles');
    table.boolean('active').defaultTo(true);
    table.text('cron_handler');
    table.text('payload');
    table.text('headers');
    table.integer('retries').defaultTo(0);
    table.integer('retry_interval').defaultTo(60000);
    table.integer('timeout').defaultTo(60000);

    table.timestamps();
  });

  await knex.schema.createTable('nc_acl', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('tn');
    table.text('acl');
    table.string('type').defaultTo('table');
    table.timestamps();
  });

  await knex.schema.createTable('nc_models', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('title');
    table.string('alias');
    table.string('type').defaultTo('table');
    table.text('meta', 'mediumtext');
    table.text('schema', 'text');
    table.text('schema_previous', 'text');
    table.text('services', 'mediumtext');
    table.text('messages', 'text');
    table.boolean('enabled').defaultTo(true);

    table.string('parent_model_title');
    table.string('show_as').defaultTo('table');
    table.text('query_params', 'mediumtext');

    table.integer('list_idx');
    table.string('tags');
    table.boolean('pinned');

    table.timestamps();
    table.index(['db_alias', 'title']);
  });

  await knex.schema.createTable('nc_relations', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias');
    table.string('tn');
    table.string('rtn');
    table.string('_tn');
    table.string('_rtn');
    table.string('cn');
    table.string('rcn');
    table.string('_cn');
    table.string('_rcn');
    table.string('referenced_db_alias');
    table.string('type');
    table.string('db_type');
    table.string('ur');
    table.string('dr');

    table.timestamps();
    table.index(['db_alias', 'tn']);
  });

  await knex.schema.createTable('nc_routes', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('title');
    table.string('tn');
    table.string('tnp');
    table.string('tnc');
    table.string('relation_type');
    table.text('path', 'text');
    table.string('type');
    table.text('handler', 'text');
    table.text('acl', 'text');
    table.integer('order');
    table.text('functions');
    table.integer('handler_type').defaultTo(1);
    table.boolean('is_custom');
    // table.text('placeholder', 'longtext');
    table.timestamps();
    table.index(['db_alias', 'title', 'tn']);
  });

  await knex.schema.createTable('nc_resolvers', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('title');
    table.text('resolver', 'text');
    table.string('type');
    table.text('acl', 'text');
    table.text('functions');
    table.integer('handler_type').defaultTo(1);
    // table.text('placeholder', 'text');
    table.timestamps();
  });

  await knex.schema.createTable('nc_loaders', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('title');
    table.string('parent');
    table.string('child');
    table.string('relation');
    table.string('resolver');
    table.text('functions');
    table.timestamps();
  });

  await knex.schema.createTable('nc_rpc', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias').defaultTo('db');
    table.string('title');
    table.string('tn');
    table.text('service', 'text');

    table.string('tnp');
    table.string('tnc');
    table.string('relation_type');
    table.integer('order');

    table.string('type');
    table.text('acl', 'text');
    table.text('functions', 'text');
    table.integer('handler_type').defaultTo(1);
    // table.text('placeholder', 'text');
    table.timestamps();
  });
  await knex.schema.createTable('nc_projects_users', (table) => {
    table.string('project_id').index(); // .references('id').inTable('nc_projects')
    // todo: foreign key
    table.integer('user_id').unsigned().index(); //.references('id').inTable('xc_users')
    table.text('roles');
    // table.text('placeholder', 'text');
    table.timestamps();
  });

  await knex.schema.createTable('nc_shared_views', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias');
    table.string('model_name');
    table.text('meta', 'mediumtext');
    table.text('query_params', 'mediumtext');
    table.string('view_id');
    table.boolean('show_all_fields');
    table.boolean('allow_copy');
    table.string('password');
    table.timestamps();
  });

  await knex.schema.createTable('nc_disabled_models_for_role', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias', 45);
    table.string('title', 45);
    table.string('type', 45);
    table.string('role', 45);
    table.boolean('disabled').defaultTo(true);

    table.string('tn');
    table.string('rtn');
    table.string('cn');
    table.string('rcn');
    table.string('relation_type');
    table.timestamps();
    table.index(
      ['project_id', 'db_alias', 'title', 'type', 'role'],
      'xc_disabled124_idx',
    );
  });

  await knex.schema.createTable('nc_plugins', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias');
    table.string('title', 45);
    table.text('description');
    table.boolean('active').defaultTo(false);
    table.float('rating');
    table.string('version');
    table.string('docs');
    table.string('status').defaultTo('install');
    table.string('status_details');
    table.string('logo');
    table.string('icon');
    table.string('tags');
    table.string('category');
    table.text('input_schema');
    table.text('input');
    table.string('creator');
    table.string('creator_website');
    table.string('price');
    table.timestamps();
  });

  // await knex('nc_plugins').insert([
  //   googleAuth,
  //   ses,
  //   cache,
  //   // ee,
  //   // brand,
  // ]);

  await knex.schema.createTable('nc_audit', (table) => {
    table.increments();
    table.string('user');
    table.string('ip');
    table.string('project_id');
    table.string('db_alias');
    table.string('model_name', 100);
    table.string('model_id', 100);
    /* op_type - AUTH, DATA, SQL, META */
    table.string('op_type');
    table.string('op_sub_type');
    table.string('status');
    table.text('description');
    table.text('details');
    table.index(
      ['db_alias', 'project_id', 'model_name', 'model_id'],
      '`nc_audit_index`',
    );

    table.timestamps();
  });

  await knex.schema.createTable('nc_migrations', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias');
    table.text('up');
    table.text('down');

    table.string('title').notNullable();
    table.string('title_down').nullable();
    table.string('description').nullable();
    table.integer('batch').nullable();
    table.string('checksum').nullable();
    table.integer('status').nullable();

    table.timestamps();
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
  await knex.schema.dropTable('nc_plugins');
  await knex.schema.dropTable('nc_disabled_models_for_role');
  await knex.schema.dropTable('nc_shared_views');
  await knex.schema.dropTable('nc_projects_users');
  await knex.schema.dropTable('nc_projects');
  await knex.schema.dropTable('nc_roles');
  await knex.schema.dropTable('nc_hooks');
  await knex.schema.dropTable('nc_store');
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
  await knex.schema.dropTable('nc_api_tokens');
};

export { up, down };
