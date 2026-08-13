import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
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
 *
 * nc_202606260001 already merged the duplicates that existed then, but the
 * constraint cannot be created while ANY remain, and rows inserted since may
 * have raced past the app-level check. The sweep below is therefore repeated
 * here rather than imported — a migration must keep describing what it did on
 * the day it ran, independent of later edits to its predecessor.
 */

type UserRow = {
  id: string;
  password: string | null;
  created_at: string | null;
};

// Membership tables keyed by a user id, with the columns that make a membership
// unique within its scope. A loser's row is dropped rather than re-pointed when
// the survivor already belongs to the same scope (it would collide on the PK).
type LinkTable = {
  table: string;
  userCol: string;
  scopeCols: string[];
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

async function repointLinkTable(
  knex: Knex,
  link: LinkTable,
  loserId: string,
  survivorId: string,
) {
  const loserRows = await knex(link.table)
    .select(link.scopeCols)
    .where(link.userCol, loserId)
    .modify((qb) => {
      if (link.where) qb.andWhere(link.where);
    });

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
      await target.delete();
    } else {
      await target.update({ [link.userCol]: survivorId });
    }
  }
}

/**
 * Keep the row with workspace membership (don't strand access), then the one
 * with a password (a real account over an invite stub), then the oldest.
 */
async function pickSurvivor(knex: Knex, rows: UserRow[]): Promise<UserRow> {
  const withMembership = new Set<string>();

  if (await knex.schema.hasTable(MetaTable.WORKSPACE_USER)) {
    const memberRows = await knex(MetaTable.WORKSPACE_USER)
      .whereIn(
        'fk_user_id',
        rows.map((r) => r.id),
      )
      .distinct('fk_user_id');
    for (const r of memberRows) withMembership.add(r.fk_user_id);
  }

  const score = (r: UserRow) =>
    (withMembership.has(r.id) ? 2 : 0) + (r.password ? 1 : 0);

  return [...rows].sort((a, b) => {
    const s = score(b) - score(a);
    if (s !== 0) return s;
    return (a.created_at ?? '').localeCompare(b.created_at ?? '');
  })[0];
}

const up = async (knex: Knex) => {
  // A tombstone that still carries a canonical email would collide with the live
  // account for that address. Account-delete nulls it now; this catches any row
  // soft-deleted before that behaviour landed.
  const neutralized = await knex(MetaTable.USERS)
    .where('is_deleted', true)
    .whereNotNull('canonical_email')
    .update({ canonical_email: null });

  const hasLinkTable: Record<string, boolean> = {};
  for (const link of LINK_TABLES) {
    hasLinkTable[link.table] = await knex.schema.hasTable(link.table);
  }

  const dupGroups: { canonical_email: string }[] = await knex(MetaTable.USERS)
    .select('canonical_email')
    .where(function () {
      this.where('is_deleted', false).orWhereNull('is_deleted');
    })
    .whereNotNull('canonical_email')
    .groupBy('canonical_email')
    .havingRaw('count(*) > 1');

  let merged = 0;

  for (const { canonical_email } of dupGroups) {
    const rows: UserRow[] = await knex(MetaTable.USERS)
      .select('id', 'password', 'created_at')
      .where('canonical_email', canonical_email)
      .where(function () {
        this.where('is_deleted', false).orWhereNull('is_deleted');
      });

    if (rows.length < 2) continue;

    const survivor = await pickSurvivor(knex, rows);

    for (const loser of rows.filter((r) => r.id !== survivor.id)) {
      for (const link of LINK_TABLES) {
        if (!hasLinkTable[link.table]) continue;
        await repointLinkTable(knex, link, loser.id, survivor.id);
      }

      // Soft-delete, never drop: keeps the merge auditable and reversible, and
      // matches what a normal account deletion leaves behind.
      await knex(MetaTable.USERS)
        .where('id', loser.id)
        .update({
          is_deleted: true,
          deleted_at: knex.fn.now(),
          email: `merged.${loser.id}.${canonical_email}`.slice(0, 255),
          canonical_email: null,
        });

      merged += 1;
    }
  }

  if (merged || neutralized) {
    logger.log(
      `Merged ${merged} duplicate user row(s) across ${dupGroups.length} address(es) and cleared ${neutralized} legacy tombstone canonical(s) before adding the unique index.`,
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
