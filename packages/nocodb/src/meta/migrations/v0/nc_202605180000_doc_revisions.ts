import type { Knex } from 'knex';
import {
  up as createDocRevisions,
  down as dropDocRevisions,
} from '~/meta/migrations/doc-revisions/nc_001_init';

// Wrapper for the doc-revisions satellite migration. Same schema runs against
// NC_DOCS_DB when configured (revisions share the docs satellite DB).
const up = async (knex: Knex) => {
  await createDocRevisions(knex);
};

const down = async (knex: Knex) => {
  await dropDocRevisions(knex);
};

export { up, down };
