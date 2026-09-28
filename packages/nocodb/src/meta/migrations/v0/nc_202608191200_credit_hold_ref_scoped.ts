import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Scope the credit-hold reservation key.
 *
 * `request_ref` was globally unique — one namespace shared by every tenant. A
 * ref another scope already held would fail to insert (and `hold` swallows
 * that as "already held", running the call unreserved), while an unscoped
 * `deleteByRequestRef` could release the wrong tenant's hold. Safe today only
 * because every caller happens to namespace its refs; this makes it schema.
 */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CREDIT_HOLDS, (table) => {
    table.dropUnique(['request_ref']);
    table.unique(['scope', 'fk_scope_id', 'request_ref']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CREDIT_HOLDS, (table) => {
    table.dropUnique(['scope', 'fk_scope_id', 'request_ref']);
    table.unique(['request_ref']);
  });
};

export { up, down };
