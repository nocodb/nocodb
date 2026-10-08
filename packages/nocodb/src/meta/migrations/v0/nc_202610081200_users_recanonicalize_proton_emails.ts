import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const PROTON_DOMAINS = [
  'proton.me',
  'protonmail.com',
  'protonmail.ch',
  'pm.me',
];

// Proton ignores `.`, `_` and `-`; fold them out of canonicals stored before normalizeEmail did.
const up = async (knex: Knex) => {
  const users: { id: string; canonical_email: string }[] = await knex(
    MetaTable.USERS,
  )
    .select('id', 'canonical_email')
    .where((qb) => {
      for (const domain of PROTON_DOMAINS) {
        qb.orWhere('canonical_email', 'like', `%@${domain}`);
      }
    });

  for (const user of users) {
    const atIndex = user.canonical_email.lastIndexOf('@');
    const canonical =
      user.canonical_email.substring(0, atIndex).replace(/[._-]/g, '') +
      user.canonical_email.substring(atIndex);

    if (canonical !== user.canonical_email) {
      await knex(MetaTable.USERS)
        .where('id', user.id)
        .update({ canonical_email: canonical });
    }
  }
};

const down = async (_knex: Knex) => {
  // The previous canonical form is not recoverable from the new one.
};

export { up, down };
