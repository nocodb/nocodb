import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Backfill cleanup for orphan rows in nc_base_users_v2.
 *
 * Before this migration, the org-level user removal flow
 * (`removeUserFromOrgCascade`) did not delete direct base memberships,
 * leaving orphan rows in nc_base_users_v2. These orphans inflated the
 * on-prem seat count reported by `NocoLicense.calculateGlobalSeatCount`.
 *
 * We delete base user rows in three cases:
 *  1. The user no longer exists in nc_users.
 *  2. The user is soft-deleted (`is_deleted = TRUE`).
 *  3. A soft-deleted workspace_user exists for the same (user, workspace)
 *     AND no active workspace_user exists for that pair. This is the
 *     exact shape produced by the org-cascade bug — narrow on purpose so
 *     legacy base-only assignments (rows with no workspace_user at all,
 *     possible in pre-EE-enforcement data) are not collateral damage.
 */
const up = async (knex: Knex) => {
  // 1. User row no longer exists
  await knex(MetaTable.PROJECT_USERS)
    .whereNotExists(function () {
      this.select(knex.raw('1'))
        .from(MetaTable.USERS)
        .whereRaw(
          `${MetaTable.USERS}.id = ${MetaTable.PROJECT_USERS}.fk_user_id`,
        );
    })
    .delete();

  // 2. User is soft-deleted
  await knex(MetaTable.PROJECT_USERS)
    .whereIn(
      'fk_user_id',
      knex(MetaTable.USERS).select('id').where('is_deleted', true),
    )
    .delete();

  // 3. Soft-deleted workspace_user exists AND no active one — the precise
  //    shape produced by the buggy org-cascade flow. Skipping rows with a
  //    null fk_workspace_id (pre-multi-workspace) is intentional.
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
