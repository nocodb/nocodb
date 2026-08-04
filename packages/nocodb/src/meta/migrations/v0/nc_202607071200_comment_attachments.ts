import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Enables attaching files/images to record comments.
//
// - `nc_comments.attachments` — JSON-serialized array of attachment metadata
//   ({ id (FileReference id), path, title, mimetype, size, ... }). Path-based,
//   never signed URLs.
// - `nc_file_references.fk_comment_id` — ties each uploaded file to its comment
//   so it can be served through the authenticated attachment proxy (same model
//   docs use), instead of via time-limited signed URLs.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.text('attachments');
  });

  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.string('fk_comment_id', 20).nullable();
    table.index(['base_id', 'fk_comment_id'], 'nc_fr_comment_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.dropIndex(['base_id', 'fk_comment_id'], 'nc_fr_comment_idx');
    table.dropColumn('fk_comment_id');
  });

  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.dropColumn('attachments');
  });
};

export { up, down };
