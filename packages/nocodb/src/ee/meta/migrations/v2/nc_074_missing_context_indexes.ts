import {
  down as downFn,
  up as upFn,
} from 'src/meta/migrations/v2/nc_074_missing_context_indexes';
import type { Knex } from 'knex';
import Noco from '~/Noco';

// In EE version of this migration is moved v3/nc_035_missing_context_indexes since fk_workspace_id is added in v3 migration for EE
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
