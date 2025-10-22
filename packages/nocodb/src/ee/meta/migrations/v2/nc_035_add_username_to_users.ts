import {
  down as downFn,
  up as upFn,
} from 'src/meta/migrations/v2/nc_035_add_username_to_users';
import type { Knex } from 'knex';
import Noco from '~/Noco';

// keep an empty migration to keep the entries in the migration table same for both ee and ce
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
