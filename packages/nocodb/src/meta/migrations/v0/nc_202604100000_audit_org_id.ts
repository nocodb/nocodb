import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const migrationStart = Date.now();
  console.log('[nc_202604100000_audit_org_id] Starting migration...');

  const hasColumn = await knex.schema.hasColumn(MetaTable.AUDIT, 'fk_org_id');

  if (!hasColumn) {
    await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
      table.string('fk_org_id', 20).nullable();
    });

    const client = knex.client.config.client;

    if (client === 'pg' || client === 'postgresql') {
      await knex.raw(
        `CREATE INDEX IF NOT EXISTS nc_audit_v2_fk_org_id_idx ON ${MetaTable.AUDIT} (fk_org_id)`,
      );
    } else if (client === 'sqlite3') {
      const idx = await knex.raw(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='nc_audit_v2_fk_org_id_idx'`,
      );
      if (!idx?.length) {
        await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
          table.index(['fk_org_id'], 'nc_audit_v2_fk_org_id_idx');
        });
      }
    } else {
      // MySQL
      const idx = await knex.raw(
        `SHOW INDEX FROM ${MetaTable.AUDIT} WHERE Key_name = 'nc_audit_v2_fk_org_id_idx'`,
      );
      if (!idx?.[0]?.length) {
        await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
          table.index(['fk_org_id'], 'nc_audit_v2_fk_org_id_idx');
        });
      }
    }
  }

  console.log(
    `[nc_202604100000_audit_org_id] Migration completed in ${Date.now() - migrationStart}ms`,
  );
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
