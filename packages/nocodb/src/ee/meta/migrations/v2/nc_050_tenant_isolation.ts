import {
  down as downFn,
  up as upFn,
} from 'src/meta/migrations/v2/nc_050_tenant_isolation';
import type { Knex } from 'knex';
import Noco from '~/Noco';

// placeholder migration for nc_023_tenant_isolation in v3
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
