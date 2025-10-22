import {
  down as downFn,
  up as upFn,
} from 'src/meta/migrations/v2/nc_064_pg_minimal_dbs';
import type { Knex } from 'knex';
import Noco from '~/Noco';

// is_local column is added from v3 migrations so this migration should be empty for cloud
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
