import { Knex } from 'knex';
import ses from '../../v1-legacy/plugins/ses';

const up = async (knex: Knex) => {
  await knex('nc_plugins').del().where({ title: 'SES' });
};

const down = async (knex: Knex) => {
  await knex('nc_plugins').insert([ses]);
};

export { up, down };
