import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Coding agents: repos and machines belong to an agent in a normal base, not
 * to a base of type `code`. Old code-project rows keep a null agent and are
 * left alone. A coding session is flagged rather than told apart by its repo,
 * which it may not have.
 */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FACTORY_REPOS, (table) => {
    table.string('fk_agent_id', 20);
    // Where a session starts when nobody names a repo; one per agent.
    table.boolean('is_default').defaultTo(false);
    // Removed from its agent; kept for the sessions still on it.
    table.boolean('deleted').defaultTo(false);
    // Where its runs branch off; null is the default branch.
    table.string('base_branch', 255);

    // A base now holds any number of repos, one set per coding agent.
    table.dropUnique(['base_id'], 'nc_factory_repos_base_uidx');
    table.index(['base_id', 'fk_agent_id'], 'nc_factory_repos_agent_idx');
  });

  await knex.schema.alterTable(MetaTable.FACTORY_MACHINES, (table) => {
    table.string('fk_agent_id', 20);
    table.index(['base_id', 'fk_agent_id'], 'nc_factory_machines_agent_idx');
    // Null runs at Standard, the stock machine's shape.
    table.string('size', 16);
    // Null is the provider's defaults: the port the preview opens on, and how long an idle machine stays up.
    table.integer('preview_port');
    table.integer('idle_minutes');
    // Variables and secrets handed to the machine, encrypted like integration configs.
    table.text('env');
    table.boolean('env_encrypted').defaultTo(false);
  });

  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.boolean('is_coding').defaultTo(false);
    table.index(['base_id', 'is_coding'], 'nc_chat_sessions_coding_idx');
  });

  await knex(MetaTable.CHAT_SESSIONS)
    .whereNotNull('fk_factory_repo_id')
    .update({ is_coding: true });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.dropIndex(['base_id', 'is_coding'], 'nc_chat_sessions_coding_idx');
    table.dropColumn('is_coding');
  });

  await knex.schema.alterTable(MetaTable.FACTORY_MACHINES, (table) => {
    table.dropIndex(
      ['base_id', 'fk_agent_id'],
      'nc_factory_machines_agent_idx',
    );
    table.dropColumn('env_encrypted');
    table.dropColumn('env');
    table.dropColumn('idle_minutes');
    table.dropColumn('preview_port');
    table.dropColumn('size');
    table.dropColumn('fk_agent_id');
  });

  // The unique index below allows one repo per base: keep the live default, else the oldest.
  const rows = await knex(MetaTable.FACTORY_REPOS)
    .select('id', 'base_id', 'is_default', 'deleted', 'created_at')
    .orderBy('created_at', 'asc');
  const keep = new Map<string, (typeof rows)[number]>();
  const rank = (row: (typeof rows)[number]) =>
    (row.deleted ? 2 : 0) + (row.is_default ? 0 : 1);

  for (const row of rows) {
    const kept = keep.get(row.base_id);
    if (!kept || rank(row) < rank(kept)) keep.set(row.base_id, row);
  }

  const keptIds = new Set([...keep.values()].map((row) => row.id));
  const extra = rows.filter((row) => !keptIds.has(row.id)).map((row) => row.id);

  for (let i = 0; i < extra.length; i += 500) {
    await knex(MetaTable.FACTORY_REPOS)
      .whereIn('id', extra.slice(i, i + 500))
      .delete();
  }

  await knex.schema.alterTable(MetaTable.FACTORY_REPOS, (table) => {
    table.dropIndex(['base_id', 'fk_agent_id'], 'nc_factory_repos_agent_idx');
    table.unique(['base_id'], { indexName: 'nc_factory_repos_base_uidx' });
    table.dropColumn('base_branch');
    table.dropColumn('deleted');
    table.dropColumn('is_default');
    table.dropColumn('fk_agent_id');
  });
};

export { up, down };
