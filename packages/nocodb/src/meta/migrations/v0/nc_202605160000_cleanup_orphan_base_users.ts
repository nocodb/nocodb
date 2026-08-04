import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Backfill: delete orphan rows in nc_base_users_v2 that inflated the
 * on-prem seat count. Targets two cases:
 *  1. fk_user_id no longer exists in nc_users
 *  2. workspace_user is soft-deleted with no active sibling row
 *     (rows with null fk_workspace_id are skipped on purpose, to avoid
 *     collateral damage to legacy base-only assignments).
 */
const up = async (knex: Knex) => {
  // Case 1: user row no longer exists
  await knex(MetaTable.PROJECT_USERS)
    .whereNotExists(function () {
      this.select(knex.raw('1'))
        .from(MetaTable.USERS)
        .whereRaw(
          `${MetaTable.USERS}.id = ${MetaTable.PROJECT_USERS}.fk_user_id`,
        );
    })
    .delete();

  // Case 2: soft-deleted workspace_user pair with no active sibling
  await knex(MetaTable.PROJECT_USERS)
    .whereNotNull('fk_workspace_id')
    .whereExists(function () {
      this.select(knex.raw('1'))
        .from(MetaTable.WORKSPACE_USER)
        .whereRaw(
          `${MetaTable.WORKSPACE_USER}.fk_user_id = ${MetaTable.PROJECT_USERS}.fk_user_id`,
        )
        .whereRaw(
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id = ${MetaTable.PROJECT_USERS}.fk_workspace_id`,
        )
        .where(`${MetaTable.WORKSPACE_USER}.deleted`, true);
    })
    .whereNotExists(function () {
      this.select(knex.raw('1'))
        .from(MetaTable.WORKSPACE_USER)
        .whereRaw(
          `${MetaTable.WORKSPACE_USER}.fk_user_id = ${MetaTable.PROJECT_USERS}.fk_user_id`,
        )
        .whereRaw(
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id = ${MetaTable.PROJECT_USERS}.fk_workspace_id`,
        )
        .where(function () {
          this.where(`${MetaTable.WORKSPACE_USER}.deleted`, false).orWhereNull(
            `${MetaTable.WORKSPACE_USER}.deleted`,
          );
        });
    })
    .delete();
};

const down = async (_knex: Knex) => {
  // Not reversible — deleted orphan rows cannot be restored.
};

export { up, down };
