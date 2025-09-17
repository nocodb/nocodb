import type { Knex } from 'knex';

// In EE version, this is handled on v3
const up = async (_knex: Knex) => {
  // empty migration
};

const down = async (_knex: Knex) => {
  // empty migration
};

export { up, down };
