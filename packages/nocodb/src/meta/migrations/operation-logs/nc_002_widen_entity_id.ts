import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// `entity_id` was sized varchar(20) for a single nanoid, but app PAGE
// permissions target a composite id `<appId>::<pageId>`
// (see appPagePermissionEntityId) that overflows 20 chars. The forward
// write lands in nc_permissions.entity_id (varchar(255)); only the
// best-effort undo-log insert failed. Widen to 255 to match that source
// column — this is the invariant "undo-log width >= widest source column".
//
// Raw SQL on purpose: knex's .string(...).alter() emits
// `... TYPE varchar(255) USING (entity_id::varchar(255))` plus redundant
// drop default/not null. The plain `ALTER COLUMN ... TYPE varchar(255)` is a
// documented catalog-only change on Postgres (no table rewrite, since 9.2),
// which the USING form does not guarantee across versions.
const up = async (knex: Knex) => {
  const client = knex.client.config.client;
  if (client === 'pg' || client === 'postgres' || client === 'postgresql') {
    await knex.raw(
      `ALTER TABLE ${MetaTable.OPERATION_LOGS} ALTER COLUMN entity_id TYPE varchar(255)`,
    );
  } else if (client === 'mysql' || client === 'mysql2') {
    await knex.raw(
      `ALTER TABLE ${MetaTable.OPERATION_LOGS} MODIFY entity_id varchar(255)`,
    );
  }
  // sqlite: varchar length is not enforced, so the column already accepts
  // the composite id — nothing to alter.
};

const down = async (knex: Knex) => {
  const client = knex.client.config.client;
  if (client === 'pg' || client === 'postgres' || client === 'postgresql') {
    await knex.raw(
      `ALTER TABLE ${MetaTable.OPERATION_LOGS} ALTER COLUMN entity_id TYPE varchar(20)`,
    );
  } else if (client === 'mysql' || client === 'mysql2') {
    await knex.raw(
      `ALTER TABLE ${MetaTable.OPERATION_LOGS} MODIFY entity_id varchar(20)`,
    );
  }
};

export { up, down };
