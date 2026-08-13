import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import { normalizeEmail, sanitizeEmail } from '~/utils/emailUtils';

const logger = new Logger('nc_202606260001_dedupe_user_emails');

const BATCH_SIZE = 2000;

/**
 * Repair user-email drift introduced before `sanitizeEmail`/`normalizeEmail`
 * learned to strip invisible (zero-width / format) characters.
 *
 * Two failure modes are fixed here:
 *
 *  1. **Corrupted single row** — a user whose stored `email` / `canonical_email`
 *     carry an invisible character. Every current lookup normalizes its input
 *     to the clean form, so it never matches the stored value: the user gets
 *     "permission denied" on access, and any invite/role flow keeps minting a
 *     fresh duplicate. Re-sanitizing the stored values in place restores the
 *     match.
 *
 *  2. **Accumulated duplicates** — repeated invite attempts against a corrupted
 *     row have already created extra `nc_users` rows for the same address. After
 *     re-sanitizing, several rows collapse to the same canonical email. We pick
 *     one survivor, re-point its memberships onto the survivor, then tombstone +
 *     soft-delete the losers so lookups become deterministic again.
 *
 *  3. **Legacy tombstones** — account-delete only started nulling
 *     `canonical_email` later, so older soft-deleted rows still carry a
 *     live-looking canonical. A soft-deleted row with a matchable canonical can
 *     shadow active accounts in lookups (the root cause), so we clear
 *     `canonical_email` on every already soft-deleted row.
 *
 * The merge is intentionally conservative: losers are **soft-deleted**
 * (`is_deleted = true`), never dropped, and only membership / role-assignment
 * rows are re-pointed. Historical attribution columns (created_by, audit author,
 * comment author, …) are left untouched — they reference a now soft-deleted row,
 * exactly as they would after a normal account deletion.
 */

type UserRow = {
  id: string;
  email: string | null;
  canonical_email: string | null;
  password: string | null;
  is_deleted: boolean | null;
  created_at: string | null;
};

// Membership / role-assignment tables keyed by a user id, with the columns that
// make a membership unique within its scope. When the survivor already has a row
// in the same scope, the loser's row is dropped instead of re-pointed (it would
// otherwise violate the composite primary key).
type LinkTable = {
  table: string;
  userCol: string;
  scopeCols: string[];
  // extra predicate (e.g. principal assignments only map users when type = 'user')
  where?: Record<string, string>;
};

const LINK_TABLES: LinkTable[] = [
  {
    table: MetaTable.WORKSPACE_USER,
    userCol: 'fk_user_id',
    scopeCols: ['fk_workspace_id'],
  },
  {
    table: MetaTable.PROJECT_USERS,
    userCol: 'fk_user_id',
    scopeCols: ['base_id'],
  },
  {
    table: MetaTable.ORG_USERS,
    userCol: 'fk_user_id',
    scopeCols: ['fk_org_id'],
  },
  {
    table: MetaTable.PRINCIPAL_ASSIGNMENTS,
    userCol: 'principal_ref_id',
    scopeCols: ['resource_type', 'resource_id', 'principal_type'],
    where: { principal_type: 'user' },
  },
];

/**
 * Re-point a single loser's membership rows in one link table onto the survivor,
 * dropping any rows that would collide with a membership the survivor already has.
 */
async function repointLinkTable(
  knex: Knex,
  link: LinkTable,
  loserId: string,
  survivorId: string,
) {
  const baseWhere = (qb: Knex.QueryBuilder) => {
    qb.where(link.userCol, loserId);
    if (link.where) qb.andWhere(link.where);
    return qb;
  };

  const loserRows = await baseWhere(knex(link.table).select(link.scopeCols));

  for (const row of loserRows) {
    const scopeMatch: Record<string, string> = {};
    for (const col of link.scopeCols) scopeMatch[col] = row[col];

    const survivorHasRow = await knex(link.table)
      .where(link.userCol, survivorId)
      .andWhere(scopeMatch)
      .first();

    const target = knex(link.table)
      .where(link.userCol, loserId)
      .andWhere(scopeMatch);
    if (link.where) target.andWhere(link.where);

    if (survivorHasRow) {
      // survivor already a member of this scope — drop the duplicate membership
      await target.delete();
    } else {
      await target.update({ [link.userCol]: survivorId });
    }
  }
}

/**
 * Pick the row to keep from a set of duplicates. Preference order:
 *   1. has any workspace membership (don't strand access)
 *   2. has a password set (a real, signed-up account over an invite stub)
 *   3. earliest created_at (the original record)
 */
async function pickSurvivor(knex: Knex, rows: UserRow[]): Promise<UserRow> {
  const ids = rows.map((r) => r.id);
  const withMembership = new Set<string>();
  // guard with hasTable for consistency with the link-table handling
  if (await knex.schema.hasTable(MetaTable.WORKSPACE_USER)) {
    const memberRows = await knex(MetaTable.WORKSPACE_USER)
      .whereIn('fk_user_id', ids)
      .distinct('fk_user_id');
    for (const r of memberRows) withMembership.add(r.fk_user_id);
  }

  const score = (r: UserRow) =>
    (withMembership.has(r.id) ? 2 : 0) + (r.password ? 1 : 0);

  return [...rows].sort((a, b) => {
    const s = score(b) - score(a);
    if (s !== 0) return s;
    // earliest created_at first
    return (a.created_at ?? '').localeCompare(b.created_at ?? '');
  })[0];
}

/**
 * Merge active rows that share a canonical email onto one survivor, then clear
 * `canonical_email` on every tombstone — leaving it unique across active users.
 *
 * Exported so the migration that adds the uniqueness constraint can re-run it:
 * rows created between the two migrations may have raced past the app-level
 * duplicate check, and the constraint cannot be created while they exist.
 */
export async function mergeDuplicateCanonicalEmails(knex: Knex): Promise<{
  duplicateGroups: number;
  merged: number;
  neutralized: number;
}> {
  const hasLinkTable: Record<string, boolean> = {};
  for (const link of LINK_TABLES) {
    hasLinkTable[link.table] = await knex.schema.hasTable(link.table);
  }

  // ---- Pass 2: merge rows that now share a canonical email -----------------
  const dupGroups: { canonical_email: string }[] = await knex(MetaTable.USERS)
    .select('canonical_email')
    .where(function () {
      this.where('is_deleted', false).orWhereNull('is_deleted');
    })
    .whereNotNull('canonical_email')
    .groupBy('canonical_email')
    .havingRaw('count(*) > 1');

  let mergedCount = 0;

  for (const { canonical_email } of dupGroups) {
    const rows: UserRow[] = await knex(MetaTable.USERS)
      .select(
        'id',
        'email',
        'canonical_email',
        'password',
        'is_deleted',
        'created_at',
      )
      .where('canonical_email', canonical_email)
      .where(function () {
        this.where('is_deleted', false).orWhereNull('is_deleted');
      });

    if (rows.length < 2) continue;

    const survivor = await pickSurvivor(knex, rows);
    const losers = rows.filter((r) => r.id !== survivor.id);

    for (const loser of losers) {
      for (const link of LINK_TABLES) {
        if (!hasLinkTable[link.table]) continue;
        await repointLinkTable(knex, link, loser.id, survivor.id);
      }

      // Tombstone the loser so it neither collides on canonical_email nor is
      // returned (then nulled) by getByEmail/getByCanonicalEmail. Soft-delete
      // keeps it auditable/reversible.
      await knex(MetaTable.USERS)
        .where('id', loser.id)
        .update({
          is_deleted: true,
          deleted_at: knex.fn.now(),
          email: `merged.${loser.id}.${canonical_email}`.slice(0, 255),
          canonical_email: null,
        });

      mergedCount += 1;
    }
  }

  // ---- Pass 3: neutralize legacy soft-deleted rows ------------------------
  // Account-delete (User.softDelete) only started nulling canonical_email later,
  // so older tombstones still carry a real canonical_email. A soft-deleted row
  // with a live-looking canonical can shadow active accounts in lookups (the
  // original bug). Match the current delete contract retroactively: clear
  // canonical_email on every already soft-deleted row that still has one.
  const neutralizedCount = await knex(MetaTable.USERS)
    .where('is_deleted', true)
    .whereNotNull('canonical_email')
    .update({ canonical_email: null });

  return {
    duplicateGroups: dupGroups.length,
    merged: mergedCount,
    neutralized: neutralizedCount,
  };
}

const up = async (knex: Knex) => {
  // ---- Pass 1: re-sanitize stored values for every non-deleted user --------
  // (this alone repairs the "corrupted single row" case)
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const users: UserRow[] = await knex(MetaTable.USERS)
      .select('id', 'email', 'canonical_email')
      .where(function () {
        this.where('is_deleted', false).orWhereNull('is_deleted');
      })
      .orderBy('id')
      .offset(offset)
      .limit(BATCH_SIZE);

    if (users.length === 0) break;
    offset += users.length;

    for (const user of users) {
      if (!user.email) continue;
      const cleanEmail = sanitizeEmail(user.email).toLowerCase();
      const canonical = normalizeEmail(user.email);
      if (cleanEmail !== user.email || canonical !== user.canonical_email) {
        await knex(MetaTable.USERS)
          .where('id', user.id)
          .update({ email: cleanEmail, canonical_email: canonical });
      }
    }
  }

  const { duplicateGroups, merged, neutralized } =
    await mergeDuplicateCanonicalEmails(knex);

  logger.log(
    `User email dedup complete: ${duplicateGroups} duplicate group(s), ${merged} row(s) merged & soft-deleted, ${neutralized} legacy soft-deleted row(s) cleared.`,
  );
};

const down = async (_knex: Knex) => {
  // Irreversible data repair — soft-deleted duplicates are intentionally left in
  // place. No-op down to keep knex migration state consistent.
};

export { up, down };
