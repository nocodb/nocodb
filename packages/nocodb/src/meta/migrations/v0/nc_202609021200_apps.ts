import type { Knex } from 'knex';
import {
  up as addChatAgentApp,
  down as dropChatAgentApp,
} from '~/meta/migrations/chat-messages/nc_006_agent_app';
import { MetaTable } from '~/utils/globals';

// The app engine and its action registry: apps, versions, the action catalogue
// and the per-version grants that gate them, plus app teams, tokens and the
// build-turn satellite.
//
// Written as the state the schema ends in, not the sequence that reached it.
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.APPS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('title', 255).notNullable();
    table.text('description');
    table.text('meta');
    table.float('order');
    table.string('fk_draft_version_id', 20);
    table.string('fk_live_version_id', 20);
    table.text('last_build_error');
    table.string('created_by', 20);
    table.boolean('deleted').defaultTo(false);
    table.string('slug', 255);
    // Publisher-owned custom domain a live app is also served on. Unique across
    // the whole deployment (host → app resolution); NULLs don't collide.
    table.string('custom_domain', 255);
    // A claim is not a proof. The domain is stored the moment it is claimed so
    // the challenge can be shown, but nothing resolves or serves on it until
    // the TXT record answers — otherwise anyone on the right plan could take
    // `app.competitor.com` sight unseen, and (once on-demand TLS opens for
    // custom domains) be handed a valid certificate for it.
    table.string('custom_domain_token', 64);
    table.timestamp('custom_domain_verified_at');
    table.timestamps(true, true);
    // Composite PK so the same id can coexist across a lane base and its
    // production base — required for merge / replay id preservation
    // (matches every other replayable meta table, see nc_051_composite_pk).
    table.primary(['base_id', 'id']);
    // An app is a base's single public front-end.
    table.unique(['base_id'], { indexName: 'nc_apps_one_per_base' });
    table.unique(['slug'], { indexName: 'nc_apps_slug' });
    table.unique(['custom_domain'], { indexName: 'nc_apps_custom_domain' });
    table.index(['base_id', 'fk_workspace_id'], 'nc_apps_context');
  });

  await knex.schema.createTable(MetaTable.APP_VERSIONS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_app_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.integer('version_number').notNullable().defaultTo(0);
    table.string('status', 20).notNullable().defaultTo('draft');
    table.string('git_sha', 40);
    table.string('created_by', 20);
    table.timestamps(true, true);
    // Composite PK — see APPS above (merge id preservation).
    table.primary(['base_id', 'id']);
    // Scope the per-app version uniqueness by base_id so a lane copy and its
    // production base can both hold the same (fk_app_id, version_number) after
    // merge (fk_app_id is itself preserved across the merge).
    table.unique(['base_id', 'fk_app_id', 'version_number'], {
      indexName: 'nc_app_versions_app_version_idx',
    });
    table.index(['base_id', 'fk_workspace_id'], 'nc_app_versions_context');
  });

  await knex.schema.createTable(MetaTable.APP_ACTIONS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20).index();
    table.string('base_id', 20).index();
    table.string('fk_app_id', 20).index();
    table.string('action_id', 255).notNullable(); // 'appointment.reschedule'
    table.string('title', 255);
    table.text('description');
    table.string('fk_current_version_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    // fk_app_id is preserved across a merge, so an unscoped
    // (fk_app_id, action_id) would collide between a lane base and the
    // production base it merges into.
    table.unique(['base_id', 'fk_app_id', 'action_id'], {
      indexName: 'nc_app_actions_app_action',
    });
  });

  await knex.schema.createTable(MetaTable.APP_ACTION_VERSIONS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20).index();
    table.string('base_id', 20).index();
    table.string('fk_action_id', 20).index();
    table.integer('version_number').notNullable();
    table.string('kind', 20).notNullable(); // 'routine' | 'handler'
    table.string('capability', 255).notNullable();
    table.boolean('idempotent').defaultTo(false);
    // The verb an action answers on. Declared by whoever authors the action —
    // the platform cannot know it. Nullable, and absent means POST.
    table.string('http_method', 10);
    // JSON Schema, never serialised zod — app schemas are zod v4 and the
    // platform is on v3, so the publish step converts inside the sandbox.
    table.text('input_schema').notNullable();
    table.text('output_schema').notNullable();
    table.text('impl').notNullable(); // routine source_ref/template, or handler uses[]
    table.string('body_hash', 64);
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    // Version numbers are what an install pins to, and `nextVersionNumber()`
    // computes max+1 with nothing behind it — concurrent publishes of the same
    // action would otherwise mint duplicate version numbers and the pin would
    // become ambiguous.
    table.unique(['base_id', 'fk_action_id', 'version_number'], {
      indexName: 'nc_app_action_versions_ver',
    });
  });

  // The pin from an app version to a specific action version. Without it an
  // invocation could only resolve the publisher-side head
  // (nc_app_actions.fk_current_version_id), so advancing that head would change
  // what every existing install already runs.
  await knex.schema.createTable(MetaTable.APP_VERSION_ACTIONS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_app_version_id', 20).notNullable();
    table.string('fk_action_id', 20).notNullable();
    table.string('fk_action_version_id', 20).notNullable();
    // The dotted wire id ('appointment.reschedule'), same width as
    // nc_app_actions.action_id — the pin is keyed by what arrives on the wire.
    table.string('action_id', 255).notNullable();
    // The action's human copy, snapshotted at publish. Reading the
    // publisher-side HEAD instead would leak draft renames into the doc every
    // build turn, and the version-keyed doc cache would serve them forever.
    table.string('title', 255);
    table.text('description');
    table.string('base_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.unique(['base_id', 'fk_app_version_id', 'action_id'], {
      indexName: 'nc_app_version_actions_pin',
    });
    table.index(['fk_action_version_id'], 'nc_app_version_actions_ver');
  });

  // Capability grants: which app team may invoke which action. Dispatch
  // resolves the caller's teams, unions their grants, and matches the requested
  // action id against them (`matchesCapability`) BEFORE any app code runs.
  //
  // Pinned to an app version, not to a team row, because a grant is publisher
  // intent declared in the manifest and versioned with the app, while
  // nc_app_teams is per-install mutable state an admin can edit. Hanging
  // versioned data off a mutable row would make every upgrade reconcile the new
  // manifest against whatever the local admin had changed, with no defined
  // resolution; here an upgrade moves the pin.
  //
  // Keyed by team HANDLE rather than fk_app_team_id: the handle is the app-
  // facing identity of an audience, and the anonymous audience has no team row
  // at all — it freezes its grants under the reserved handle `public`.
  await knex.schema.createTable(MetaTable.APP_VERSION_GRANTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_app_version_id', 20).notNullable();
    // Matches nc_app_teams.handle (64).
    table.string('team_handle', 64).notNullable();
    // An exact action id ('invoice.void') or a glob ('billing.*'). Same width
    // as nc_app_actions.action_id, since an exact grant IS an action id.
    table.string('capability', 255).notNullable();
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    // One row per (version, team, capability) — a repeated grant in the
    // manifest is a no-op, not a duplicate the union would count twice.
    table.unique(
      ['base_id', 'fk_app_version_id', 'team_handle', 'capability'],
      {
        indexName: 'nc_app_version_grants_pin',
      },
    );
    // Dispatch reads by (version, handles) on every invocation.
    table.index(
      ['fk_app_version_id', 'team_handle'],
      'nc_app_version_grants_lookup',
    );
  });

  // Base-scoped like the rest of the app tree: a team DEFINITION is authored
  // content. It travels — an environment copy carries it, converge replays edits
  // back, an install receives it with its id preserved — so the same team id is
  // expected to exist in several bases at once and only (base_id, id) names one
  // row. Who is IN the team does not travel; that is nc_app_team_members.
  await knex.schema.createTable(MetaTable.APP_TEAMS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_app_id', 20).notNullable();
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('title', 255).notNullable();
    table.string('handle', 64).notNullable();
    // 'admin' | 'members' | null. The anonymous audience is NOT a team: it has
    // no roster, and its grants live on `nc_apps_v2.meta.public_capabilities`.
    table.string('system_key', 20);
    table.boolean('include_all_base_members').defaultTo(false);
    table.boolean('include_base_creators').defaultTo(false);
    // Capability grants for this team, as a JSON array of action ids or globs.
    // Authored alongside the team and snapshotted into `nc_app_version_grants`
    // at publish — the team is the subject every other rule already binds to,
    // so its capabilities live with it rather than in a parallel registry.
    table.text('capabilities');
    table.text('meta');
    table.float('order');
    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.unique(['base_id', 'fk_app_id', 'handle'], {
      indexName: 'nc_app_teams_handle_idx',
    });
    table.index(['fk_app_id'], 'nc_app_teams_app_idx');
    table.index(['fk_workspace_id'], 'nc_app_teams_workspace_idx');
  });

  // The roster: tenant state, deliberately NOT part of the app tree. A team
  // definition is authored on a lane and converges to production; membership is
  // set once, on production, and is never serialized into a copy or an install
  // (`intentionallyNotSerializedMetaTables`). Base-scoped for the same reason
  // nc_app_teams now is — one team id lives in several bases, and a shared row
  // would make a lane's roster stand in for production's.
  //
  // Hard delete, no `roles`: a row IS the membership, and every membership is
  // the same tier — what a member may do comes from the team's capabilities.
  await knex.schema.createTable(MetaTable.APP_TEAM_MEMBERS, (table) => {
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    // Denormalised from the team so app-wide sweeps (the single-team rule,
    // "remove from app", standing reaping) are one query rather than one per team.
    table.string('fk_app_id', 20).notNullable();
    table.string('fk_app_team_id', 20).notNullable();
    // 'user' | 'team' — a workspace team can be a member, and then its own
    // roster resolves dynamically at match time.
    table.string('principal_type', 20).notNullable();
    table.string('principal_ref_id', 20).notNullable();
    // Team principals only: how far down the team tree the membership reaches.
    table.string('hierarchy_scope', 30);
    table.string('invited_by', 20);
    table.timestamps(true, true);

    table.primary(
      ['base_id', 'fk_app_team_id', 'principal_type', 'principal_ref_id'],
      'nc_app_team_members_pk',
    );
    table.index(
      ['base_id', 'fk_app_id', 'principal_type', 'principal_ref_id'],
      'nc_atm_app_principal',
    );
    // A deleted workspace team must be swept out of every app team at once.
    table.index(['principal_type', 'principal_ref_id'], 'nc_atm_principal');
  });

  await knex.schema.createTable(MetaTable.APP_INTEGRATION_GRANTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    // Base-scoped: a lane copy preserves both the app id and the grant id, so
    // a grant is only unique per base. Granting inside a lane must not reach
    // production — the lane is where you try an integration out.
    table.string('base_id', 20);
    table.string('fk_app_id', 20).notNullable();
    table.string('fk_integration_id', 20).notNullable();
    table.string('status', 20).notNullable().defaultTo('pending');
    table.text('reason');
    table.string('requested_by', 20);
    table.string('granted_by', 20);
    table.timestamp('granted_at');
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.index(['base_id', 'fk_app_id'], 'nc_aig_app');
    // Deliberately NOT base-scoped: an integration dies workspace-wide, so
    // revoking it must sweep every base's grants at once.
    table.index(['fk_workspace_id', 'fk_integration_id'], 'nc_aig_integration');
  });

  await knex.schema.createTable(MetaTable.APP_ARTIFACTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_app_id', 20).notNullable();
    table.string('git_sha', 40).notNullable();
    // 'repo' | 'dist' | 'published' — which storage object this sha owns.
    table.string('kind', 20).notNullable();
    table.timestamps(true, true);
    table.primary(['id']);
    // Idempotent record(): one row per (app, sha, kind).
    table.unique(['fk_app_id', 'git_sha', 'kind'], {
      indexName: 'nc_app_artifacts_uniq',
    });
    // Drives the per-app orphan sweep + delete-cascade lookup.
    table.index(['fk_workspace_id', 'fk_app_id'], 'nc_app_artifacts_app');
  });

  // The connection an app DECLARES it needs, and the binding that satisfies it.
  //
  // An integration action names a slot instead of a workspace integration id, so
  // an agent can author against a provider nobody has connected yet and whoever
  // holds the credential binds it later — the publisher while building, or the
  // installer at setup. The key is app-owned and stable for the app's life, which
  // is what lets an upgrade line up with what an installer already bound however
  // many times the actions on it were re-versioned.
  await knex.schema.createTable(MetaTable.APP_CONNECTION_SLOTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20).index();
    table.string('base_id', 20).index();
    table.string('fk_app_id', 20).index();
    // Stable, app-owned key — what impl.source_ref.connection.slot names.
    table.string('slot', 64).notNullable();
    // The provider a connection must be to satisfy this slot.
    table.string('sub_type', 60).notNullable();
    table.string('title', 255).notNullable();
    // Why the app needs it — shown in the setup wizard and the store listing.
    table.text('purpose');
    // 'shared' | 'per_user'. Null accepts either.
    table.string('required_credential_mode', 20);
    table.boolean('optional').defaultTo(false);
    // The binding. Null until someone holding the credential connects it;
    // blanked at publish so it never travels between tenants.
    table.string('fk_integration_id', 20);
    table.integer('order');
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    // fk_app_id survives a lane merge, so an unscoped (fk_app_id, slot) would
    // collide between a lane base and the base it merges into — same reason
    // nc_app_actions scopes its own uniqueness by base.
    table.unique(['base_id', 'fk_app_id', 'slot'], {
      indexName: 'nc_app_connection_slots_slot',
    });
  });

  // The routes an app version serves to anonymous visitors, and (from P1) the
  // team a self-signup lands in. Snapshotted at publish from
  // `App.meta.public_routes`, so serving reads publisher intent pinned to the
  // version rather than mutable app state — the same reason
  // `nc_app_version_grants` exists.
  //
  // Rows carry only app-relative paths, team handles, bundle-relative asset refs
  // and publisher-declared third-party embed origins: no tenant identifiers by
  // construction, so the table replicates into an install as-is.
  await knex.schema.createTable(
    MetaTable.APP_VERSION_PUBLIC_ROUTES,
    (table) => {
      table.string('id', 20).notNullable();
      table.string('fk_workspace_id', 20).index();
      table.string('base_id', 20).index();
      table.string('fk_app_version_id', 20).notNullable().index();
      // 'page' (P0) | 'signup' (P1). One column so the version's whole public
      // surface is one cached list read at serve time.
      table.string('kind', 20).notNullable();
      // Null for kind='signup'.
      table.string('path', 512);
      // Null for kind='page'; matches nc_app_teams.handle for kind='signup'.
      table.string('team_handle', 64);
      // page  → { title, description, og_image, embed_origins }
      // signup→ policy
      table.text('meta');
      table.integer('order');
      table.timestamps(true, true);
      table.primary(['base_id', 'id']);
      // A NULL `path` is not deduped by Postgres, so this does not enforce the
      // single-signup-row rule — the publish service does (P1).
      table.unique(['base_id', 'fk_app_version_id', 'kind', 'path'], {
        indexName: 'nc_app_version_public_routes_uq',
      });
    },
  );

  // An app-scoped bearer credential for the app's own external API + MCP surface.
  //
  // Deliberately NOT nc_api_tokens: spec-app-auth D12 forbids an app origin ever
  // accepting a console credential (a publisher may terminate TLS on a custom app
  // domain), and the app world's permission vocabulary is action-id globs, not the
  // console's resource categories.
  //
  // fk_user_id is the PERSONA — the token acts as its creator and is re-resolved
  // against live App Team membership on every request, so it can never outrank the
  // person who minted it.
  await knex.schema.createTable(MetaTable.APP_TOKENS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20).index();
    table.string('base_id', 20).index();
    table.string('fk_app_id', 20).index();
    table.string('fk_user_id', 20).notNullable();
    table.string('title', 255);
    // sha256 of the plaintext. The plaintext is returned once and never stored.
    table.string('token_hash', 64).notNullable();
    table.string('token_prefix', 16);
    // Reserved for per-token namespace grants (`op.*`, `op.read`). ALWAYS NULL
    // in v1 — a token carries its persona's full capability set. Present now so
    // that phase costs no second migration.
    table.text('capabilities');
    table.timestamp('expires_at');
    table.timestamp('last_used_at');
    table.timestamp('revoked_at');
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    // The auth hot path: a global lookup by hash, before any base is known —
    // the row is what tells us which one.
    table.index(['token_hash'], 'nc_app_tokens_hash');
    // The console list, and the revoke sweeps a durable credential needs.
    table.index(['fk_app_id', 'fk_user_id'], 'nc_app_tokens_persona');
  });

  await knex.schema.createTable(MetaTable.APP_AGENT_SESSIONS, (table) => {
    table.string('id', 20);
    table.string('fk_workspace_id', 20).index();
    table.string('base_id', 20).index();
    table.string('fk_app_id', 20).index();
    // The runner. Not an FK to base users: an app-only collaborator is a member
    // of the app and of no base.
    table.string('fk_user_id', 20);
    table.string('title', 255);
    // Same three counters as nc_chat_sessions, same names and types: the console
    // assistant and the in-app one are the same kind of object, and a second
    // spelling for the same number is how reporting queries drift. Cumulative
    // totals for per-app cost attribution — the credit meter stays the billing
    // authority; these are the app owner's own visible numbers.
    table.integer('total_input_tokens').defaultTo(0);
    table.integer('total_output_tokens').defaultTo(0);
    table.integer('message_count').defaultTo(0);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    // MANY conversations per (app, user) — the widget lists them in a sidebar
    // and the person picks one, so this is an index, not a unique key. Scoped by
    // base_id for the same reason as every other app table: a lane copy and its
    // production base can both hold the same fk_app_id after a merge.
    table.index(
      ['base_id', 'fk_app_id', 'fk_user_id'],
      'nc_app_agent_sessions_app_user',
    );
  });

  await knex.schema.createTable(MetaTable.APP_AGENT_MESSAGES, (table) => {
    table.string('id', 20);
    table.string('fk_workspace_id', 20).index();
    table.string('base_id', 20).index();
    table.string('fk_session_id', 20);
    table.string('role', 20); // 'user' | 'assistant'
    table.text('content');
    // AppAgentContentBlock[] — text, tool calls with their approval state, and
    // errors. The tool blocks are what makes a turn re-renderable after reload.
    table.text('parts');
    // The app version this turn ran against. A conversation can outlive a
    // republish, and the tools available to a turn are the ones THAT version
    // pinned — so it is recorded per message, not per session.
    table.string('fk_app_version_id', 20);
    // Mirrors nc_chat_messages: which model answered, and what it cost.
    table.string('model', 100);
    table.integer('input_tokens').defaultTo(0);
    table.integer('output_tokens').defaultTo(0);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.index(
      ['base_id', 'fk_session_id', 'created_at'],
      'nc_app_agent_messages_session',
    );
  });

  // Build turns persist as normal chat messages: `agent` attributes the
  // producing persona and `fk_app_id` records which app a turn targeted.
  // Per-(conversation, app) Claude session pointers live in
  // nc_chat_sessions.meta.appBuilds (JSON — no column change).
  await addChatAgentApp(knex);
};

const down = async (knex: Knex) => {
  await dropChatAgentApp(knex);

  await knex.schema.dropTableIfExists(MetaTable.APP_AGENT_MESSAGES);
  await knex.schema.dropTableIfExists(MetaTable.APP_AGENT_SESSIONS);
  await knex.schema.dropTable(MetaTable.APP_TOKENS);
  await knex.schema.dropTable(MetaTable.APP_VERSION_PUBLIC_ROUTES);
  await knex.schema.dropTable(MetaTable.APP_CONNECTION_SLOTS);
  await knex.schema.dropTable(MetaTable.APP_ARTIFACTS);
  await knex.schema.dropTable(MetaTable.APP_INTEGRATION_GRANTS);
  await knex.schema.dropTable(MetaTable.APP_TEAM_MEMBERS);
  await knex.schema.dropTable(MetaTable.APP_TEAMS);
  await knex.schema.dropTable(MetaTable.APP_VERSION_GRANTS);
  await knex.schema.dropTable(MetaTable.APP_VERSION_ACTIONS);
  await knex.schema.dropTable(MetaTable.APP_ACTION_VERSIONS);
  await knex.schema.dropTable(MetaTable.APP_ACTIONS);
  await knex.schema.dropTable(MetaTable.APP_VERSIONS);
  await knex.schema.dropTable(MetaTable.APPS);
};

export { up, down };
