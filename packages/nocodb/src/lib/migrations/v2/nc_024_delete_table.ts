import { MetaTableOld } from '../../utils/globals';
import { Knex } from 'knex';

/***
 * Delete unused v2 meta tables
 *
 * "nc_orgs_v2"
 * "nc_team_users_v2"
 * "nc_teams_v2"
 *
 *****/

const up = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTableOld.TEAM_USERS);
  await knex.schema.dropTableIfExists(MetaTableOld.TEAMS);
  await knex.schema.dropTableIfExists(MetaTableOld.ORGS);
};

const down = async (_knex: Knex) => {
  // not required since we are not using these tables in older versions
};

export { up, down };
