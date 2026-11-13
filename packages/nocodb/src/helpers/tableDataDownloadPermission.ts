import { getStandingRole, PermissionEntity, PermissionKey } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { Permission } from '~/models';
import { NcError } from '~/helpers/catchError';

/** Throws 403 unless the caller passes the table's TABLE_DATA_DOWNLOAD grant; no grant means everyone. */
export async function assertTableDataDownloadAllowed(
  context: NcContext,
  params: {
    modelId: string;
    user?: { id?: string; is_agent?: boolean } & Record<string, any>;
    permissions?: Permission[];
  },
) {
  const permissions =
    params.permissions ??
    context.permissions ??
    (await Permission.list(context, context.base_id));

  const permission = permissions?.find(
    (p) =>
      p.entity === PermissionEntity.TABLE &&
      p.entity_id === params.modelId &&
      p.permission === PermissionKey.TABLE_DATA_DOWNLOAD,
  );

  if (!permission) return;

  const user = params.user;

  const allowed =
    !!user?.id &&
    (await Permission.isAllowed(context, permission, {
      id: user.id,
      role: getStandingRole(user),
      is_agent: user.is_agent,
    }));

  if (!allowed) {
    NcError.get(context).forbidden(
      'You do not have permission to download data from this table',
    );
  }
}
