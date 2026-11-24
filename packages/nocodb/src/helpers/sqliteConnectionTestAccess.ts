import { extractRolesObj, ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import {
  extractSqliteFilename,
  isSameSqliteFile,
} from '~/helpers/validateSqliteFilename';
import { User } from '~/models';
import Noco from '~/Noco';
import rolePermissions from '~/utils/acl';
import { roleAllowsPermission } from '~/helpers/roleAllowsPermission';
import { MetaTable, RootScopes } from '~/utils/globals';

export const SQLITE_SOURCE_UNAVAILABLE_MESSAGE =
  'SQLite data sources are only available on the free self-hosted edition';

export const isSqliteClient = (client: unknown): boolean =>
  typeof client === 'string' && client.includes('sqlite');

const isSqliteConnection = (config: unknown, subType?: unknown): boolean => {
  const c = (config && typeof config === 'object' ? config : {}) as {
    client?: unknown;
    connection?: { client?: unknown };
  };
  return [subType, c.client, c.connection?.client].some(isSqliteClient);
};

/**
 * SQLite connections are only offered where `Noco.isEE()` is false (CE and
 * unlicensed On-Prem). `previous` is the stored connection on an update: an
 * existing SQLite one keeps saving while its file is unchanged.
 */
export function assertSqliteConnectionAllowed(
  context: Pick<NcContext, 'api_version'> | undefined,
  config: unknown,
  subType?: unknown,
  previous?: { config: unknown; subType?: unknown },
): void {
  if (!Noco.isEE() || !isSqliteConnection(config, subType)) return;

  if (previous && isSqliteConnection(previous.config, previous.subType)) {
    const filename = extractSqliteFilename(config);
    if (
      filename === undefined ||
      isSameSqliteFile(filename, extractSqliteFilename(previous.config))
    ) {
      return;
    }
  }

  NcError.get(context).badRequest(
    'SQLite connections are only available on the free self-hosted edition',
  );
}

const grants = (
  roles: Record<string, boolean> | null | undefined,
  operation: string,
): boolean =>
  Object.entries(roles ?? {}).some(
    ([name, hasRole]) =>
      hasRole && roleAllowsPermission(rolePermissions[name], operation),
  );

// Who may save a source in the workspace: the permissions the integration,
// base and source create routes check.
async function canAddDataSource(
  user: { id: string; roles?: unknown },
  workspaceId?: string,
): Promise<boolean> {
  if (grants(extractRolesObj(user.roles), 'integrationCreate')) return true;
  if (!workspaceId) return false;

  const { workspace_roles } = await User.getWithRoles(
    { workspace_id: workspaceId, base_id: RootScopes.BYPASS },
    user.id,
    { workspaceId },
  );
  if (
    grants(workspace_roles, 'integrationCreate') ||
    grants(workspace_roles, 'baseCreate')
  ) {
    return true;
  }

  const sourceCreatorRoles = Object.values(ProjectRoles).filter((role) =>
    grants({ [role]: true }, 'sourceCreate'),
  );
  const baseWithPermission = await Noco.ncMeta
    .knex(MetaTable.PROJECT_USERS)
    .innerJoin(
      MetaTable.PROJECT,
      `${MetaTable.PROJECT}.id`,
      `${MetaTable.PROJECT_USERS}.base_id`,
    )
    .where(`${MetaTable.PROJECT_USERS}.fk_user_id`, user.id)
    .where(`${MetaTable.PROJECT}.fk_workspace_id`, workspaceId)
    .whereIn(`${MetaTable.PROJECT_USERS}.roles`, sourceCreatorRoles)
    .first();

  return !!baseWithPermission;
}

/**
 * A SQLite test tells whether a server path opens, so only a caller who could
 * save a SQLite source may run it.
 */
export async function assertCanTestSqliteConnection(
  config: { client?: unknown } | null | undefined,
  user: { id: string; roles?: unknown },
  workspaceId?: string,
): Promise<void> {
  if (!isSqliteClient(config?.client)) return;
  if (!(await canAddDataSource(user, workspaceId))) {
    NcError.badRequest(SQLITE_SOURCE_UNAVAILABLE_MESSAGE);
  }
}
