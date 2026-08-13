import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { mergeDuplicateCanonicalEmails } from '~/meta/migrations/v0/nc_202606260001_dedupe_user_emails';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_202608121000_unique_user_canonical_email');

const INDEX_NAME = 'nc_users_v2_canonical_email_unique';

/**
 * Enforce one active account per canonical email at the storage layer.
 *
 * Signup checked for an existing email and then inserted, with a bcrypt hash in
 * between — a ~100ms window in which two concurrent requests both passed the
 * check and both inserted. Only the database can close that; the application
 * check now merely produces the friendly error.
 *
 * Tombstones are unaffected: soft-delete nulls `canonical_email`, and SQL treats
 * NULLs as distinct, so a deleted account never blocks re-registration.
 */
const up = async (knex: Knex) => {
  // Rows created since the dedupe migration may have raced past the app check;
  // the index cannot be created while duplicates exist.
  const { duplicateGroups, merged } = await mergeDuplicateCanonicalEmails(knex);

  if (merged) {
    logger.log(
      `Merged ${merged} duplicate user row(s) across ${duplicateGroups} address(es) before adding the unique index.`,
    );
  }

  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.unique(['canonical_email'], { indexName: INDEX_NAME });
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropUnique(['canonical_email'], INDEX_NAME);
  });
};

export { up, down };
