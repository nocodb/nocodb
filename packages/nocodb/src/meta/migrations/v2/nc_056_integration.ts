import { IntegrationsType, ProjectRoles } from 'nocodb-sdk';
import { customAlphabet } from 'nanoid';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const log = (message: string) => {
  console.log(`nc_055_integration: ${message}`);
};

let hrTime = process.hrtime();

const logExecutionTime = (message: string) => {
  const [seconds, nanoseconds] = process.hrtime(hrTime);
  const elapsedSeconds = seconds + nanoseconds / 1e9;
  log(`${message} in ${elapsedSeconds}s`);
};

const up = async (knex: Knex) => {
  const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

  if (!(await knex.schema.hasTable(MetaTable.INTEGRATIONS))) {
    await knex.schema.createTable(MetaTable.INTEGRATIONS, (table) => {
      table.string('id', 20).primary();
      table.string('title', 128);
      table.text('config');
      table.text('meta');
      table.string('type', 20).index();
      table.string('sub_type', 20);
      table.boolean('is_private').defaultTo(false);
      table.boolean('deleted').defaultTo(false);

      table.string('created_by', 20).index();

      table.float('order');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasColumn(MetaTable.SOURCES, 'fk_integration_id'))) {
    await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
      table.string('fk_integration_id', 20).index();
    });
  }

  hrTime = process.hrtime();

  // get all external sources, add them to integrations table and map back to bases
  const sources = await knex(MetaTable.SOURCES)
    .select(`${MetaTable.SOURCES}.*`)
    .select(`${MetaTable.PROJECT_USERS}.fk_user_id as created_by`)
    .innerJoin(
      MetaTable.PROJECT,
      `${MetaTable.SOURCES}.base_id`,
      `${MetaTable.PROJECT}.id`,
    )
    .where((qb) =>
      qb
        .where(`${MetaTable.SOURCES}.is_meta`, false)
        .orWhereNull(`${MetaTable.SOURCES}.is_meta`),
    )
    .leftJoin(MetaTable.PROJECT_USERS, (qb) => {
      qb.on(
        `${MetaTable.PROJECT}.id`,
        `${MetaTable.PROJECT_USERS}.base_id`,
      ).andOn(
        `${MetaTable.PROJECT_USERS}.roles`,
        knex.raw('?', [ProjectRoles.OWNER]),
      );
    });

  logExecutionTime('Fetched external sources');

  hrTime = process.hrtime();
  for (const source of sources) {
    const integrationId = `int${nanoidv2()}`;

    const integration = {
      title: source.alias,
      id: integrationId,
      config: source.config,
      type: IntegrationsType.Database,
      sub_type: source.type,
      created_by: source.created_by,
      created_at: source.created_at,
      updated_at: source.updated_at,
    };

    await knex(MetaTable.INTEGRATIONS).insert(integration);
    await knex(MetaTable.SOURCES).where('id', source.id).update({
      fk_integration_id: integrationId,
    });
  }

  logExecutionTime('Migrated external sources');
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.INTEGRATIONS);

  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.dropColumn('fk_integration_id');
  });
};

export { up, down };
