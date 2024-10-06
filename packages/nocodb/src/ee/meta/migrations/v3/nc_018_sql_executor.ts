import { customAlphabet } from 'nanoid';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const up = async (knex: Knex) => {
  if (await knex.schema.hasTable(MetaTable.DB_MUX)) {
    await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
      table.dropColumn('fk_sql_executor_id');
    });
    await knex.schema.dropTable(MetaTable.DB_MUX);
  }

  await knex.schema.createTable(MetaTable.DB_MUX, (table) => {
    table.string('id', 20).primary();
    table.string('domain', 50);
    table.string('status', 20);
    table.integer('priority');
    table.integer('capacity');
    table.timestamps(true, true);
  });

  const predefinedDbMuxes = [];
  for (let i = 0; i < 30; i++) {
    predefinedDbMuxes.push({
      id: `nc${nanoidv2()}`,
      domain: `http://se-${(i + 1).toString().padStart(5, '0')}.${
        process.env.NC_ENV === 'prod' ? 'prod' : 'staging'
      }.internal`,
      status: 'inactive',
      priority: i + 1,
      capacity: 25,
    });
  }

  await knex(MetaTable.DB_MUX).insert(predefinedDbMuxes);

  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.string('fk_sql_executor_id', 20).index();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.dropColumn('fk_sql_executor_id');
  });
  await knex.schema.dropTable(MetaTable.DB_MUX);
};

export { up, down };
