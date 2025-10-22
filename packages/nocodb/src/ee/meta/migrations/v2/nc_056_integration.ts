import {
  down as downFn,
  up as upFn,
} from 'src/meta/migrations/v2/nc_056_integration';
import type { Knex } from 'knex';
import Noco from '~/Noco';

// In EE version of this migration is moved v3/nc_025_integration.ts since is_local column is added in v3 migration
const up = async (knex: Knex) => {
  if (Noco.firstEeLoad) {
    return upFn(knex);
  }
};

const down = async (knex: Knex) => {
  if (Noco.firstEeLoad) {
    return downFn(knex);
  }
};

export { up, down };
