import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn(MetaTable.AUDIT, 'fk_org_id');
  if (!hasColumn) {
    await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
      table.string('fk_org_id', 20).nullable();
      table.index(['fk_org_id'], 'nc_audit_v2_fk_org_id_idx');
    });
  }
};

const down = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn(MetaTable.AUDIT, 'fk_org_id');
  if (hasColumn) {
    await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
      table.dropIndex(['fk_org_id'], 'nc_audit_v2_fk_org_id_idx');
      table.dropColumn('fk_org_id');
    });
  }
};

export { up, down };
