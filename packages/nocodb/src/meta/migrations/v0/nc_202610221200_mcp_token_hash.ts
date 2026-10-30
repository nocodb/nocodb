import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import { sha256Hex } from '~/helpers/sha256';

const BATCH_SIZE = 500;

/**
 * Hashes every MCP secret still held only in clear. Safe to re-run: a row with
 * a hash is never touched again.
 *
 * `token` is left in place: pods on the previous image still compare against
 * it during the rollout. A follow-up release clears it.
 */
export const hashPlaintextMcpTokens = async (knex: Knex) => {
  const client = knex.client.config.client;
  const pending = (qb: Knex.QueryBuilder) =>
    qb.whereNotNull('token').whereNull('token_hash');

  // One statement, so the ALTER's lock is not held through a row-by-row loop.
  if (client === 'pg' || client === 'postgresql') {
    await pending(knex(MetaTable.MCP_TOKENS)).update({
      token_hash: knex.raw("encode(sha256(convert_to(??, 'UTF8')), 'hex')", [
        'token',
      ]),
    });
    return;
  }

  if (client.includes('mysql')) {
    await pending(knex(MetaTable.MCP_TOKENS)).update({
      token_hash: knex.raw('LOWER(SHA2(??, 256))', ['token']),
    });
    return;
  }

  for (;;) {
    const rows = await pending(knex(MetaTable.MCP_TOKENS))
      .select('id', 'token')
      .limit(BATCH_SIZE);

    if (!rows.length) return;

    for (const row of rows) {
      await knex(MetaTable.MCP_TOKENS)
        .where({ id: row.id })
        .whereNull('token_hash')
        .update({ token_hash: sha256Hex(row.token) });
    }
  }
};

const up = async (knex: Knex) => {
  // Nullable with no default: metadata-only on PG, so no table rewrite.
  await knex.schema.alterTable(MetaTable.MCP_TOKENS, (table) => {
    table.string('token_hash', 64);
  });

  await hashPlaintextMcpTokens(knex);
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MCP_TOKENS, (table) => {
    table.dropColumn('token_hash');
  });
};

export { up, down };
