import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Shareable invite links for a base or a workspace.
 *
 * `token_hash` is the only thing the redeem path looks up -- a sha256 of a
 * 256-bit secret, so it is one indexed equality check with no room for prefix
 * probing or timing.
 *
 * `token` holds the same secret so the UI can show the link again, which is the
 * same trade the codebase already makes for `base.uuid` and `view.uuid`. Keeping
 * lookup on the hash means moving this column to encrypted-at-rest later is a
 * change to two lines in the model, not a redesign.
 */
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.INVITE_LINKS, (table) => {
    table.string('id', 20).primary();

    table.string('scope', 20).notNullable();
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);

    table.string('token_hash', 64).notNullable();
    table.string('token', 255).notNullable();

    table.string('role', 50).notNullable();
    table.string('email_domain', 255);

    table.dateTime('expires_at');
    table.integer('max_uses');
    table.integer('used_count').defaultTo(0);
    table.dateTime('revoked_at');

    table.string('created_by', 20);

    table.timestamps(true, true);

    // The redeem path's only lookup.
    table.unique(['token_hash'], 'nc_invite_links_token_hash_unq');
    table.index(['base_id'], 'nc_invite_links_base_idx');
    table.index(['fk_workspace_id'], 'nc_invite_links_ws_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.INVITE_LINKS);
};

export { up, down };
