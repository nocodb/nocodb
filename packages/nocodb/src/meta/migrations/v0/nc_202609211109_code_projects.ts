import { customAlphabet } from 'nanoid';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Same shape `genNanoid` gives a base id.
const baseNanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

/**
 * Every repo configured before code projects existed becomes one, and its
 * sessions, messages and artifacts move under it.
 *
 * Messages and artifacts are only moved in this database — a deployment with a
 * separate NC_CHAT_DB keeps the old transcripts unscoped.
 */
const backfill = async (knex: Knex) => {
  const repos = await knex(MetaTable.FACTORY_REPOS).whereNull('base_id');

  if (!repos.length) return;

  const [{ max }] = await knex(MetaTable.PROJECT).max('order as max');
  let order = Number(max) || 0;

  for (const repo of repos) {
    const baseId = `p${baseNanoid()}`;
    const at = knex.fn.now();

    await knex(MetaTable.PROJECT).insert({
      id: baseId,
      fk_workspace_id: repo.fk_workspace_id,
      title: String(repo.full_name).split('/').pop().slice(0, 50),
      type: 'code',
      prefix: '',
      is_meta: false,
      deleted: false,
      order: ++order,
      version: 2,
      meta: '{"iconColor":"#36BFFF"}',
      created_at: at,
      updated_at: at,
    });

    if (repo.created_by) {
      await knex(MetaTable.PROJECT_USERS).insert({
        base_id: baseId,
        fk_workspace_id: repo.fk_workspace_id,
        fk_user_id: repo.created_by,
        roles: 'owner',
        created_at: at,
        updated_at: at,
      });
    }

    await knex(MetaTable.FACTORY_REPOS)
      .where({ id: repo.id })
      .update({ base_id: baseId });

    const sessionIds = (
      await knex(MetaTable.CHAT_SESSIONS)
        .where({
          fk_workspace_id: repo.fk_workspace_id,
          fk_factory_repo_id: repo.id,
        })
        .select('id')
    ).map((row) => row.id);

    if (!sessionIds.length) continue;

    for (const table of [MetaTable.CHAT_MESSAGES, MetaTable.CHAT_ARTIFACTS]) {
      await knex(table)
        .where({ fk_workspace_id: repo.fk_workspace_id })
        .whereIn('fk_session_id', sessionIds)
        .update({ base_id: baseId });
    }

    await knex(MetaTable.CHAT_SESSIONS)
      .where({ fk_workspace_id: repo.fk_workspace_id })
      .whereIn('id', sessionIds)
      .update({ base_id: baseId });
  }
};

/**
 * Code projects: a repo now belongs to one `nc_bases` row of type `code`, and
 * its sessions are scoped to that base instead of the workspace.
 */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FACTORY_REPOS, (table) => {
    table.string('base_id', 20);

    // Bases are soft-deleted, so the repo can't stay unique per workspace.
    table.dropUnique(
      ['fk_workspace_id', 'fk_integration_id', 'provider_repo_id'],
      'nc_factory_repos_provider_uidx',
    );
    table.unique(['base_id'], { indexName: 'nc_factory_repos_base_uidx' });
    // The installation-revoked webhook looks repos up by connection alone.
    table.index(['fk_integration_id'], 'nc_factory_repos_integration_idx');
  });

  // Same index name, so the drop has to land before the create.
  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.dropIndex(
      ['fk_workspace_id', 'fk_factory_repo_id'],
      'nc_chat_sessions_factory_idx',
    );
  });
  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.index(
      ['base_id', 'fk_factory_repo_id'],
      'nc_chat_sessions_factory_idx',
    );
  });

  // Every sandbox, for life: which session it serves, whether it is running,
  // and when the provider will pause it. Workspace-scoped; `base_id` only so
  // a base delete can sweep it without walking sessions.
  await knex.schema.createTable(MetaTable.COMPUTE_INSTANCES, (table) => {
    table.string('id', 20).primary();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_session_id', 20);

    // Qualified provider id, `<provider>:<native id>`.
    table.string('compute_id', 255);
    table.string('workload', 32);

    table.float('vcpus');
    table.float('memory_gib');

    // running | paused | killed
    table.string('state', 16);
    // The open billing window's hold ref; null unless running.
    table.string('window_ref', 255);
    // The turn request holding the sandbox; its settle correlates to the turn.
    table.string('held_ref', 255);

    table.timestamp('started_at');
    table.timestamp('expires_at');
    table.timestamp('last_touched_at');

    table.timestamps(true, true);

    table.unique(['compute_id'], {
      indexName: 'nc_compute_instances_cid_uidx',
    });
    table.index(['state', 'expires_at'], 'nc_compute_instances_sweep_idx');
    table.index(['fk_session_id'], 'nc_compute_instances_session_idx');
  });

  await backfill(knex);
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.COMPUTE_INSTANCES);

  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.dropIndex(
      ['base_id', 'fk_factory_repo_id'],
      'nc_chat_sessions_factory_idx',
    );
  });
  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.index(
      ['fk_workspace_id', 'fk_factory_repo_id'],
      'nc_chat_sessions_factory_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.FACTORY_REPOS, (table) => {
    table.dropIndex(['fk_integration_id'], 'nc_factory_repos_integration_idx');
    table.dropUnique(['base_id'], 'nc_factory_repos_base_uidx');
    table.unique(
      ['fk_workspace_id', 'fk_integration_id', 'provider_repo_id'],
      'nc_factory_repos_provider_uidx',
    );
    table.dropColumn('base_id');
  });
};

export { up, down };
