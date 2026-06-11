import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import { normalizeEmail } from '~/utils/emailUtils';

const BATCH_SIZE = 5000;

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.string('canonical_email');
    table.index('canonical_email');
  });

  // Backfill canonical_email in batches
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const users = await knex(MetaTable.USERS)
      .select('id', 'email')
      .whereNull('canonical_email')
      .whereNotNull('email')
      .limit(BATCH_SIZE);

    if (users.length === 0) break;

    // Group by canonical value to batch updates where possible
    const updatesByCanonical = new Map<string, string[]>();
    for (const user of users) {
      const canonical = normalizeEmail(user.email);
      if (!updatesByCanonical.has(canonical)) {
        updatesByCanonical.set(canonical, []);
      }
      updatesByCanonical.get(canonical).push(user.id);
    }

    for (const [canonical, ids] of updatesByCanonical) {
      await knex(MetaTable.USERS)
        .whereIn('id', ids)
        .update({ canonical_email: canonical });
    }
  }
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('canonical_email');
  });
};

export { up, down };
