import { ProjectRoles } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.INTEGRATIONS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20).index();
    table.text('config');
    table.text('meta');
    table.string('type', 20).index();

    table.boolean('is_private').defaultTo(false);

    table.string('created_by', 20).index();

    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.BASES, (table) => {
    table.string('fk_integration_id', 20).index();
  });

  // get all external sources, add them to integrations table and map them to bases
  const sources = await knex(MetaTable.BASES)
    .select(`${MetaTable.BASES}.*`)
    .select(`${MetaTable.PROJECT_USERS}.user_id as created_by`)
    .innerJoin(
      MetaTable.PROJECT,
      `${MetaTable.BASES}.base_id`,
      `${MetaTable.PROJECT}.id`,
    )
    .where((qb) =>
      qb
        .where(`${MetaTable.BASES}.is_meta`, false)
        .orWhereNull(`${MetaTable.BASES}.is_meta`),
    )
    .andWhere((qb) =>
      qb
        .where(`${MetaTable.BASES}.is_local`, false)
        .orWhereNull(`${MetaTable.BASES}.is_local`),
    )
    .leftJoin(
      MetaTable.PROJECT_USERS,
      `${MetaTable.PROJECT}.id`,
      `${MetaTable.PROJECT_USERS}.base_id`,
    )
    .on(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.OWNER);

  for (const source of sources) {
    const integration = {
      id: source.id,
      fk_workspace_id: source.fk_workspace_id,
      config: source.config,
      meta: JSON.stringify(source.meta),
      type: source.type,
      is_private: source.is_private,
      created_by: source.created_by,
      created_at: source.created_at,
      updated_at: source.updated_at,
    };

    await knex(MetaTable.INTEGRATIONS).insert(integration);
    await knex(MetaTable.BASES)
      .where('fk_source_id', source.id)
      .update({ fk_integration_id: source.id });
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropSchema(MetaTable.BASE_SOURCES);
};

export { up, down };
