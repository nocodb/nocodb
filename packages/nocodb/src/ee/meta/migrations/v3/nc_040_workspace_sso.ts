import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SSO_CLIENT, (table) => {
    table.string('fk_workspace_id', 20).index('sso_client_fk_workspace_id_idx');
  });

  await knex.schema.alterTable(MetaTable.ORG_DOMAIN, (table) => {
    table.string('fk_workspace_id', 20).index('org_domain_fk_workspace_id_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.ORG, (table) => {
    table.dropColumn('fk_workspace_id');
  });
};

export { up, down };
