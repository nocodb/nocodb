import { Injectable, Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import Noco from '~/Noco';
import { sha256Hex } from '~/helpers/sha256';
import { MetaTable } from '~/utils/globals';

const BATCH_SIZE = 500;

// Fills the hash of session refresh and OAuth tokens issued before it existed,
// and repairs one a pod on the previous image left stale by rotating only the
// clear value. Keyset-paged, and each UPDATE is keyed on the clear values read,
// so a re-run or a concurrent rotation only ever skips a row; the clear columns
// are left for the old image.
@Injectable()
export class AuthTokenHashBackfillMigration {
  private readonly logger = new Logger(AuthTokenHashBackfillMigration.name);

  async job() {
    const { refreshTokens, oauthTokens } = await this.backfill();

    this.logger.log(
      `Hashed ${refreshTokens} refresh token(s) and ${oauthTokens} OAuth token(s)`,
    );

    return true;
  }

  async backfill() {
    return {
      refreshTokens: await this.backfillRefreshTokens(),
      oauthTokens: await this.backfillOAuthTokens(),
    };
  }

  // The table has no primary key; `token` is indexed and unique in practice.
  private async backfillRefreshTokens() {
    const knex = Noco.ncMeta.knexConnection;
    let lastToken = '';
    let hashed = 0;

    for (;;) {
      const rows = await knex(MetaTable.USER_REFRESH_TOKENS)
        .select('token', 'token_hash')
        .whereNotNull('token')
        .where('token', '>', lastToken)
        .orderBy('token', 'asc')
        .limit(BATCH_SIZE);

      if (!rows.length) break;

      for (const { token, token_hash } of rows) {
        const hash = sha256Hex(token);
        if (token_hash === hash) continue;

        hashed += Number(
          await knex(MetaTable.USER_REFRESH_TOKENS)
            .where({ token })
            .where((q) =>
              q.whereNull('token_hash').orWhereNot('token_hash', hash),
            )
            .update({ token_hash: hash }),
        );
      }

      lastToken = rows[rows.length - 1].token;
    }

    return hashed;
  }

  private async backfillOAuthTokens() {
    const knex = Noco.ncMeta.knexConnection;
    let lastId = '';
    let hashed = 0;

    const equalOrNull = (
      q: Knex.QueryBuilder,
      column: string,
      value: string | null,
    ) => (value == null ? q.whereNull(column) : q.where(column, value));

    for (;;) {
      const rows = await knex(MetaTable.OAUTH_TOKENS)
        .select(
          'id',
          'access_token',
          'refresh_token',
          'access_token_hash',
          'refresh_token_hash',
        )
        .where((q) =>
          q.whereNotNull('access_token').orWhereNotNull('refresh_token'),
        )
        .where('id', '>', lastId)
        .orderBy('id', 'asc')
        .limit(BATCH_SIZE);

      if (!rows.length) break;

      for (const row of rows) {
        // A hash whose clear value is already gone is kept as is.
        const update: Record<string, string> = {};
        for (const column of ['access_token', 'refresh_token']) {
          const hash = row[column] != null ? sha256Hex(row[column]) : null;
          if (hash && row[`${column}_hash`] !== hash) {
            update[`${column}_hash`] = hash;
          }
        }
        if (!Object.keys(update).length) continue;

        hashed += Number(
          await knex(MetaTable.OAUTH_TOKENS)
            .where({ id: row.id })
            .where((q) => equalOrNull(q, 'access_token', row.access_token))
            .where((q) => equalOrNull(q, 'refresh_token', row.refresh_token))
            .update(update),
        );
      }

      lastId = rows[rows.length - 1].id;
    }

    return hashed;
  }
}
