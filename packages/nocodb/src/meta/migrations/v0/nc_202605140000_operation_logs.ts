import type { Knex } from 'knex';
import {
  up as createOperationLogs,
  down as dropOperationLogs,
} from '~/meta/migrations/operation-logs/nc_001_init';

const up = async (knex: Knex) => {
  await createOperationLogs(knex);
};

const down = async (knex: Knex) => {
  await dropOperationLogs(knex);
};

export { up, down };
