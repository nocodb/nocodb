// import ses from '../../v1-legacy/plugins/ses';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex('nc_plugins').del().where({ title: 'SES' });
};

const down = async (_: Knex) => {
  // await knex('nc_plugins').insert([ses]);
};

export { up, down };
