import type { Knex } from 'knex';
import {
  up as createDocRevisions,
  down as dropDocRevisions,
} from '~/meta/migrations/docs-content/nc_002_doc_revisions';
import { MetaTable } from '~/utils/globals';

// Wrapper for the doc-revisions satellite migration. Same schema runs against
// NC_DOCS_DB when configured (revisions share the docs satellite DB). Also
// adds fk_revision_id to nc_file_references for revision-owned snapshot rows
// (meta DB only — file refs don't satellitize).
const up = async (knex: Knex) => {
  await createDocRevisions(knex);

  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.string('fk_revision_id', 20).nullable();
  });
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.index(['base_id', 'fk_revision_id'], 'nc_fr_revision_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.dropIndex(['base_id', 'fk_revision_id'], 'nc_fr_revision_idx');
    table.dropColumn('fk_revision_id');
  });

  await dropDocRevisions(knex);
};

export { up, down };
