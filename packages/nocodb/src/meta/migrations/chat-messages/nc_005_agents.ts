import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Agent messages, and the web artifacts a chat or agent turn publishes.
 *
 * Canonical schema for the chat-messages satellite (NC_CHAT_DB) — both the v0
 * migration and XcMigrationSourceChatMessages import from here, so a deployment
 * without NC_CHAT_DB gets the same tables in its meta DB.
 */
const up = async (knex: Knex) => {
  if (!(await knex.schema.hasTable(MetaTable.AGENT_MESSAGES))) {
    await knex.schema.createTable(MetaTable.AGENT_MESSAGES, (table) => {
      table.string('id', 20).notNullable();

      table.string('fk_workspace_id', 20);
      table.string('base_id', 20).notNullable();

      table.string('fk_session_id', 20).notNullable();
      table.string('fk_agent_id', 20).notNullable();

      table.string('role', 20).notNullable();
      table.text('content');
      // Ordered content blocks (text + tool_use) — the source of truth for replay.
      table.text('parts');
      // Attachment JSON: user uploads and sandbox-produced outputs.
      table.text('files');
      table.text('created_files');

      table.string('model', 255);
      table.integer('input_tokens').defaultTo(0);
      table.integer('output_tokens').defaultTo(0);

      table.timestamps(true, true);

      table.primary(['base_id', 'id']);
      table.index(
        ['fk_workspace_id', 'base_id', 'fk_session_id', 'created_at'],
        'nc_agent_messages_session_idx',
      );
    });
  }

  // Published web artifacts (see publish_web_artifact) — tracked separately from
  // nc_chat_messages.created_files so each one gets a real, stable id (not a
  // JSON blob field) to mint/serve against. Bytes live in webArtifactBundles
  // (content-addressed, keyed by content_hash); this row is the identity +
  // ownership layer.
  if (!(await knex.schema.hasTable(MetaTable.CHAT_ARTIFACTS))) {
    await knex.schema.createTable(MetaTable.CHAT_ARTIFACTS, (table) => {
      table.string('id', 20);

      table.string('fk_workspace_id', 20);
      table.string('base_id', 20);
      table.string('fk_session_id', 20);
      table.string('fk_message_id', 20);

      // content_hash is the built `index.html` — enough to serve the page, not to
      // change it. source_hash is the git bundle it was built from, and is
      // nullable: artifacts published before source capture have no bundle.
      table.string('content_hash', 64);
      table.string('source_hash', 64);

      table.string('title', 255);
      table.string('mimetype', 100);
      table.integer('size').defaultTo(0);

      // project_path is the stable identity — republishing the same
      // scaffold_web_artifact project is a new version, not a new artifact.
      // fk_root_artifact_id is null on the first version (that row IS the root);
      // every later version points at the root's id. version is 1-based,
      // incrementing per project_path within a session.
      table.string('fk_root_artifact_id', 20);
      table.integer('version').defaultTo(1);
      table.text('project_path');

      table.string('uuid', 255);
      table.boolean('is_public').defaultTo(false);

      table.timestamps(true, true);

      table.primary(['id']);
      // Matches the actual read pattern: list by workspace + base + session,
      // then group by fk_message_id in JS (no per-message query/index needed).
      table.index(
        ['fk_workspace_id', 'base_id', 'fk_session_id'],
        'nc_chat_artifacts_session_idx',
      );
      table.index(['uuid'], 'nc_chat_artifacts_uuid_idx');
    });
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.CHAT_ARTIFACTS);
  await knex.schema.dropTableIfExists(MetaTable.AGENT_MESSAGES);
};

export { up, down };
