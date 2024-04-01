import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.ORG, (table) => {
    table.string('id', 20).primary();

    table.string('title');
    table.string('slug').index();
    table.string('fk_user_id', 20).index();

    // for any additional meta info like logo, favicon, etc...
    table.text('meta');
    table.string('image', 20);
    table.boolean('is_share_enabled').defaultTo(false);

    table.boolean('deleted').defaultTo(false);
    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.ORG_USERS, (table) => {
    table.string('fk_org_id', 20).primary();
    table.string('fk_user_id', 20).primary();
    table.string('roles', 255);

    // todo: add additional org level profile fields if necessary

    table.timestamps(true, true);
  });
  await knex.schema.createTable(MetaTable.ORG_DOMAIN, (table) => {
    table.string('id', 20).primary();

    table.string('fk_org_id', 20).index();
    table.string('fk_user_id', 20).index();

    table.string('domain', 255).index();
    table.boolean('verified');
    table.string('txt_value', 255);
    table.timestamp('last_verified');
    table.boolean('deleted').defaultTo(false);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SSO_CLIENT_DOMAIN, (table) => {
    table.string('fk_sso_client_id', 20).primary();
    table.string('fk_org_domain_id', 20).primary();

    table.boolean('enabled').defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.SSO_CLIENT, (table) => {
    table.renameColumn('fk_workspace_id', 'fk_org_id');
  });

  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.string('fk_org_id', 20).index();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.ORG_USERS);
  await knex.schema.dropTable(MetaTable.ORG);
  await knex.schema.alterTable(MetaTable.SSO_CLIENT, (table) => {
    table.renameColumn('fk_org_id', 'fk_workspace_id');
  });
};

export { up, down };
