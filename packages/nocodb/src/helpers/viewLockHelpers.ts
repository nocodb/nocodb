import { extractRolesObj, ProjectRoles, ViewLockType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { NcError } from '~/helpers/catchError';
import View from '~/models/View';

/**
 * Editor on the base without creator/owner rights — the role the locked-view
 * and personal-view gates apply to (same test as the extract-ids ACL gate).
 */
export function isEditorOnly(user?: NcRequest['user']): boolean {
  const roles = extractRolesObj(user?.base_roles);
  return !!(
    roles?.[ProjectRoles.EDITOR] &&
    !roles?.[ProjectRoles.CREATOR] &&
    !roles?.[ProjectRoles.OWNER]
  );
}

/**
 * Rejects an editor changing the configuration (filters, sorts, fields,
 * layout) of a locked view, or of a personal view owned by someone else.
 * Callers without a request user (internal jobs) are not checked.
 */
export function assertViewConfigEditable(
  context: NcContext,
  view: Pick<View, 'lock_type' | 'owned_by'> | null | undefined,
  req?: Pick<NcRequest, 'user'>,
) {
  if (!view || !isEditorOnly(req?.user)) return;

  if (
    view.lock_type === ViewLockType.Locked ||
    (view.lock_type === ViewLockType.Personal &&
      view.owned_by &&
      view.owned_by !== req.user?.id)
  ) {
    NcError.get(context).forbidden('Unauthorized access');
  }
}

export async function assertViewIdConfigEditable(
  context: NcContext,
  viewId: string | null | undefined,
  req?: Pick<NcRequest, 'user'>,
  ncMeta?: MetaService,
) {
  if (!viewId || !isEditorOnly(req?.user)) return;
  assertViewConfigEditable(
    context,
    await View.get(context, viewId, false, ncMeta),
    req,
  );
}
