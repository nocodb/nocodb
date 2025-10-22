import {
  down as downFn,
  up as upFn,
} from 'src/meta/migrations/v2/nc_092_composite_pk';
import type { Knex } from 'knex';
import Noco from '~/Noco';

// In EE version, this is handled on v3
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
