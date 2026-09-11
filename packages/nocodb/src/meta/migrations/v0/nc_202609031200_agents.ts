import type { Knex } from 'knex';
import {
  up as createAgentSatellite,
  down as dropAgentSatellite,
} from '~/meta/migrations/chat-messages/nc_005_agents';
import { MetaTable } from '~/utils/globals';

/**
 * The agents vertical: agents and their sessions, the message and artifact
 * satellite, channels, the skills catalog and its policies, and folders.
 *
 * Sections alters `nc_agents`, so agents is created first.
 */
const up = async (knex: Knex) => {
  // ── Agents, their sessions, and the message satellite ──
  await knex.schema.createTable(MetaTable.AGENTS, (table) => {
    table.string('id', 20).notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20).notNullable();

    table.string('title', 255).notNullable();
    table.text('description');

    table.text('config');
    table.boolean('enabled').defaultTo(true);

    table.float('order');
    table.text('meta');

    table.string('created_by', 20);
    table.string('updated_by', 20);

    table.boolean('deleted').defaultTo(false);

    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.index('id', 'nc_agents_id_idx');
    table.index(['base_id', 'fk_workspace_id'], 'nc_agents_context_idx');
  });

  // A session IS a run: `trigger_type='chat'` stays open across turns, anything
  // else is one triggered firing.
  await knex.schema.createTable(MetaTable.AGENT_SESSIONS, (table) => {
    table.string('id', 20).notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20).notNullable();
    table.string('fk_agent_id', 20).notNullable();
    // Null for triggered sessions — nobody started them.
    table.string('fk_user_id', 20);

    table.string('title', 255);

    table.string('trigger_type', 60);
    table.text('trigger_payload');
    // Agent-to-agent hops that led here. Caps trigger cycles.
    table.integer('chain_depth').defaultTo(0);

    table.string('status', 20).defaultTo('active');
    table.string('skip_reason', 40);
    table.timestamp('started_at');
    table.timestamp('finished_at');
    // Reserved for a scheduled resume. Nothing writes it today: a run parked on
    // a tool approval waits as long as the person does.
    table.timestamp('resume_at');

    table.text('meta');

    table.integer('total_input_tokens').defaultTo(0);
    table.integer('total_output_tokens').defaultTo(0);

    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.index('id', 'nc_agent_sessions_id_idx');
    table.index(['base_id', 'fk_agent_id'], 'nc_agent_sessions_agent_idx');
    table.index(['base_id', 'fk_user_id'], 'nc_agent_sessions_user_idx');
    // Activity tab + the already-in-progress guard.
    table.index(
      ['base_id', 'fk_agent_id', 'trigger_type', 'status'],
      'nc_agent_sessions_activity_idx',
    );
    table.index(['status', 'resume_at'], 'nc_agent_sessions_resume_idx');
  });

  // Messages and published artifacts — satellite DB (NC_CHAT_DB)
  await createAgentSatellite(knex);

  // ── Channels — the surfaces an agent can be reached on ──
  await knex.schema.createTable(MetaTable.AGENT_CHANNELS, (table) => {
    table.string('id', 20).notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20).notNullable();
    table.string('fk_agent_id', 20).notNullable();
    // The channel integration supplying credentials and transport.
    table.string('fk_integration_id', 20).notNullable();

    table.string('channel_type', 50);
    table.string('title', 255);
    table.boolean('enabled').defaultTo(true);

    table.text('settings');
    // Opaque per-channel secret for inbound verification.
    table.text('webhook_secret');
    // Handle returned by the adapter's onActivateHook, passed back to
    // onDeactivateHook so removal only clears this channel's own registration.
    table.text('activation_state');

    table.string('created_by', 20);

    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.index('id', 'nc_agent_channels_id_idx');
    table.index(['base_id', 'fk_agent_id'], 'nc_agent_channels_agent_idx');
    // A channel integration serves one agent at a time — checked on create.
    table.index(['fk_integration_id'], 'nc_agent_channels_integration_idx');
  });

  // Maps a platform conversation onto an agent session, so a Telegram chat
  // keeps its context: fk_channel_id is nc_agent_channels.id.
  await knex.schema.createTable(MetaTable.AGENT_CHANNEL_THREADS, (table) => {
    table.string('id', 20);

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_channel_id', 20);
    table.string('fk_session_id', 20);

    // Platform conversation key — Slack thread_ts, Discord channel, repo#issue.
    table.string('external_thread_id', 255);
    table.string('external_room_id', 255);

    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    // One session per platform conversation; also the lookup on every message.
    table.unique(
      ['fk_channel_id', 'external_thread_id'],
      'nc_agent_channel_threads_uq',
    );
  });

  // ── Skills catalog ──
  await knex.schema.createTable(MetaTable.SKILLS, (table) => {
    table.string('id', 20).notNullable().primary();

    // Where the skill hangs in the containment chain: org → workspace → base
    // → user. Polymorphic rather than a column per owner, so resolution is one
    // shape everywhere.
    table.string('scope', 16);
    table.string('scope_id', 20);

    // The hot path: injected into the system prompt on every turn.
    table.string('title', 255).notNullable();
    table.text('description');

    // Presentation metadata, read from the skill's frontmatter. Columns rather
    // than a blob because the catalog list filters and sorts on them.
    table.string('category', 32);
    table.string('version', 20);
    table.string('icon', 64);

    // Key into bundle storage — resolves to `SKILL.md` and its siblings.
    table.string('content_hash', 64);

    table.boolean('enabled').defaultTo(true);

    // 'official' | 'community' — always supplied on insert.
    table.string('source_type', 20);
    table.text('source_ref');
    // Commit installed from, so an update check needs no download.
    table.string('source_commit', 40);

    table.string('created_by', 20);
    table.string('updated_by', 20);

    table.timestamps(true, true);

    // Every resolution is "the skills at this scope", and that is the only way
    // the table is ever read.
    table.index(['scope', 'scope_id'], 'nc_skills_scope_idx');
    // Bundles are content-addressed and shared, so GC asks this column whether
    // any live row still references a hash before freeing it.
    table.index('content_hash', 'nc_skills_content_hash_idx');
  });

  await knex.schema.createTable(MetaTable.SKILL_POLICIES, (table) => {
    table.string('id', 20).notNullable().primary();

    // Same polymorphic pair as nc_skills, so one scope reads the same way
    // everywhere. Only `org` and `workspace` set a policy — a base or a person
    // is governed by one, never the author of one.
    table.string('scope', 16).notNullable();
    table.string('scope_id', 20).notNullable();

    table.string('community', 20);
    table.text('allowlist');
    table.string('personal', 20);

    table.string('created_by', 20);
    table.string('updated_by', 20);
    table.timestamps(true, true);

    // One policy per scope — resolution reads a single row, so a second would
    // make which one governs a matter of insertion order.
    table.unique(['scope', 'scope_id'], 'nc_skill_policies_scope_idx');
  });

  // ── Agent folders, and the agent FK into them ──
  await knex.schema.createTable(MetaTable.AGENT_SECTIONS, (table) => {
    table.string('id', 20);

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.string('title', 255);
    table.float('order');
    table.text('meta');

    table.string('created_by', 20);
    table.string('updated_by', 20);

    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.index('id', 'nc_agent_sections_id_idx');
    table.index(['base_id', 'fk_workspace_id'], 'nc_agent_sections_context');
  });

  await knex.schema.alterTable(MetaTable.AGENTS, (table) => {
    table.string('fk_agent_section_id', 20).nullable();
  });
};

const down = async (knex: Knex) => {
  // ── Agent folders, and the agent FK into them ──
  await knex.schema.alterTable(MetaTable.AGENTS, (table) => {
    table.dropColumn('fk_agent_section_id');
  });

  await knex.schema.dropTableIfExists(MetaTable.AGENT_SECTIONS);

  // ── Skills catalog ──
  await knex.schema.dropTableIfExists(MetaTable.SKILL_POLICIES);
  await knex.schema.dropTableIfExists(MetaTable.SKILLS);

  // ── Channels — the surfaces an agent can be reached on ──
  await knex.schema.dropTableIfExists(MetaTable.AGENT_CHANNEL_THREADS);
  await knex.schema.dropTableIfExists(MetaTable.AGENT_CHANNELS);

  // ── Agents, their sessions, and the satellite tables ──
  await dropAgentSatellite(knex);
  await knex.schema.dropTableIfExists(MetaTable.AGENT_SESSIONS);
  await knex.schema.dropTableIfExists(MetaTable.AGENTS);
};

export { up, down };
