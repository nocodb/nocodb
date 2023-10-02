import type { Knex } from 'knex';
const up = async (_knex: Knex) => {
  // keep an empty migration to keep the entries in the migration table same for both ee and ce
};

const down = async (_knex: Knex) => {};

export { up, down };
