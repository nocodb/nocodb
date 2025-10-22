import {
  down as downFn,
  up as upFn,
} from 'src/meta/migrations/v2/nc_065_encrypt_flag';
import type { Knex } from 'knex';
import Noco from '~/Noco';

// In EE version of this migration is moved v3/nc_029_encrypt_flag.ts since integration table will be created in v3 migration
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
