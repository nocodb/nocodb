import { Injectable, Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { NcContext } from 'nocodb-sdk';
import NocoCache from '~/cache/NocoCache';
import MCPToken from '~/models/MCPToken';
import Noco from '~/Noco';
import { sha256Hex } from '~/helpers/sha256';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';

const BATCH_SIZE = 500;

// Re-hashes every non-null `token` (it may be newer than the hash) and clears it; the column is dropped later.
@Injectable()
export class McpTokenPlaintextCleanupMigration {
  private readonly logger = new Logger(McpTokenPlaintextCleanupMigration.name);

  async job() {
    const knex = Noco.ncMeta.knexConnection;

    let lastId = '';
    let cleared = 0;

    for (;;) {
      const rows = await this.readBatch(knex, lastId);

      if (!rows.length) break;

      for (const row of rows) {
        const tokenHash = sha256Hex(row.token);

        // Cache first: if this throws, the row keeps `token` and a re-run retries it.
        await this.writeCachedSecret(row, {
          token: null,
          token_hash: tokenHash,
        });

        const updated = await knex(MetaTable.MCP_TOKENS)
          .where({ id: row.id, token: row.token })
          .update({ token_hash: tokenHash, token: null });

        if (updated) {
          cleared += Number(updated);
          continue;
        }

        // A regenerate landed after the read and wins: cache what the row now holds.
        const current = await knex(MetaTable.MCP_TOKENS)
          .select('token', 'token_hash')
          .where({ id: row.id })
          .first();
        if (current) await this.writeCachedSecret(row, current);
      }

      lastId = rows[rows.length - 1].id;
    }

    this.logger.log(`Cleared ${cleared} plaintext MCP token(s)`);

    return true;
  }

  protected async readBatch(knex: Knex, lastId: string) {
    return knex(MetaTable.MCP_TOKENS)
      .select('id', 'token', 'fk_workspace_id', 'base_id')
      .whereNotNull('token')
      .where('id', '>', lastId)
      .orderBy('id', 'asc')
      .limit(BATCH_SIZE);
  }

  // Pods on the previous image validate a cached `token` before the hash.
  private async writeCachedSecret(
    row: { id: string; fk_workspace_id: string; base_id: string },
    secret: { token: string | null; token_hash: string | null },
  ) {
    const key = `${CacheScope.MCP_TOKEN}:${row.id}`;
    const contexts: NcContext[] = [
      { workspace_id: row.fk_workspace_id, base_id: row.base_id },
      MCPToken.metaContext(row),
      {
        workspace_id: RootScopes.FULL_BYPASS,
        base_id: RootScopes.FULL_BYPASS,
      },
    ];

    for (const context of contexts) {
      await NocoCache.update(context, key, secret);
    }
  }
}
