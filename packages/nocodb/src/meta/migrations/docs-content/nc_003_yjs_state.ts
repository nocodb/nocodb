import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Adds the Yjs CRDT binary state column to nc_doc_content_v2. Runs against the
// meta DB (via v0 importer) and/or NC_DOCS_DB (via XcMigrationSourceDocsContent).
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DOC_CONTENT, (table) => {
    table.binary('yjs_state').nullable();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DOC_CONTENT, (table) => {
    table.dropColumn('yjs_state');
  });
};

export { up, down };
