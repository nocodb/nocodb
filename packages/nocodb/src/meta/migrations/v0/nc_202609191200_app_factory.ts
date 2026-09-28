import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * App Factory: repos a workspace can dispatch an agent against, and the link
 * from a chat session to the repo and source it was started on.
 *
 * Nothing here is GitHub-shaped — the provider comes from the connection's
 * integration `sub_type`, so GitLab and Bitbucket need no schema change.
 */
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.FACTORY_REPOS, (table) => {
    table.string('id', 20).primary();

    table.string('fk_workspace_id', 20);
    // The Auth integration holding the installation / OAuth token.
    table.string('fk_integration_id', 20);

    // The provider's own repo id — survives renames, unlike full_name.
    table.string('provider_repo_id', 64);
    table.string('full_name', 255);
    // Self-hosted GitLab isn't at a well-known host, so the clone URL is stored.
    table.string('remote_url');
    table.string('default_branch', 255);

    table.boolean('is_private').defaultTo(false);
    // Hide a repo from the composer without losing its sessions.
    table.boolean('enabled').defaultTo(true);

    table.text('meta');
    table.string('created_by', 20);

    table.timestamps(true, true);

    table.index(['fk_workspace_id', 'enabled'], 'nc_factory_repos_ws_idx');
    // Repo ids are only unique within a provider, so the connection is part of the key.
    table.unique(
      ['fk_workspace_id', 'fk_integration_id', 'provider_repo_id'],
      'nc_factory_repos_provider_uidx',
    );
  });

  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    // Null on every session that isn't a factory run.
    table.string('fk_factory_repo_id', 20);
    // prompt | branch | pr | issue
    table.string('source_kind', 20);
    // Branch name, or the PR / issue number as text.
    table.string('source_ref', 255);

    // ── Spawned agents ──────────────────────────────────────────────────────
    // A spawned agent is a session of its own, not a tool result: it has a
    // conversation the user can open and read like any other. This is the spawn
    // edge; which tool call it belongs under is read off that call's own result,
    // which already carries the child's id.
    table.string('fk_parent_session_id', 20);
    // explorer | worker — what the child was spawned as.
    table.string('agent_role', 40);

    table.index(
      ['fk_workspace_id', 'fk_factory_repo_id'],
      'nc_chat_sessions_factory_idx',
    );
    table.index(['fk_parent_session_id'], 'nc_chat_sessions_parent_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.dropIndex(
      ['fk_workspace_id', 'fk_factory_repo_id'],
      'nc_chat_sessions_factory_idx',
    );
    table.dropIndex(['fk_parent_session_id'], 'nc_chat_sessions_parent_idx');
    table.dropColumn('fk_factory_repo_id');
    table.dropColumn('source_kind');
    table.dropColumn('source_ref');
    table.dropColumn('fk_parent_session_id');
    table.dropColumn('agent_role');
  });

  await knex.schema.dropTableIfExists(MetaTable.FACTORY_REPOS);
};

export { up, down };
