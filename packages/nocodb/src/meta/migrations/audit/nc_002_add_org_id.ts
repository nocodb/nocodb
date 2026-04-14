import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn(MetaTable.AUDIT, 'fk_org_id');
  if (!hasColumn) {
    await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
      table.string('fk_org_id', 20).nullable();
      table.index(['fk_org_id'], 'nc_audit_v2_fk_org_id_idx');
    });
  } else {
    // Column exists (from nc_001_init) but index may not
    try {
      await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
        table.index(['fk_org_id'], 'nc_audit_v2_fk_org_id_idx');
      });
    } catch {
      // Index already exists — safe to ignore
    }
  }
};

const down = async (knex: Knex) => {
  try {
    await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
      table.dropIndex(['fk_org_id'], 'nc_audit_v2_fk_org_id_idx');
    });
  } catch {
    // Index doesn't exist — safe to ignore
  }
};

export { up, down };
