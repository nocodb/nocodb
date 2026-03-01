import { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

const SEAT_CONSUMING_ROLES = [
  // Workspace-level
  WorkspaceUserRoles.OWNER,
  WorkspaceUserRoles.CREATOR,
  WorkspaceUserRoles.EDITOR,
  // Base-level
  ProjectRoles.OWNER,
  ProjectRoles.CREATOR,
  ProjectRoles.EDITOR,
];

/**
 * Calculate the number of editors (seat-consuming users) across the instance.
 * Counts distinct users who have at least one editor-or-above role
 * at either workspace or base level.
 *
 * EE on-prem overrides this with full team-aware seat calculation.
 */
export async function calculateInstanceEditorCount(
  ncMeta = Noco.ncMeta,
): Promise<number> {
  const knex = ncMeta.knexConnection;

  // Users with a seat-consuming workspace role
  const wsEditors = knex(MetaTable.WORKSPACE_USER)
    .select('fk_user_id')
    .whereIn('roles', SEAT_CONSUMING_ROLES);

  // Users with a seat-consuming base role
  const baseEditors = knex(MetaTable.PROJECT_USERS)
    .select('fk_user_id')
    .whereIn('roles', SEAT_CONSUMING_ROLES);

  // Count distinct users who appear in either set
  const result = await knex(MetaTable.USERS)
    .where((qb) => {
      qb.whereIn(`${MetaTable.USERS}.id`, wsEditors).orWhereIn(
        `${MetaTable.USERS}.id`,
        baseEditors,
      );
    })
    .count('id as count')
    .first();

  return Number(result?.count ?? 0);
}
