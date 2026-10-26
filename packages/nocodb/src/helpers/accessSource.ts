import {
  extractRolesObj,
  NcAccessSource,
  ProjectRoles,
  SHARED_VIEW_ACCESS_SOURCES,
  ViewTypes,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';

/**
 * Route params that identify a share surface. Every one also flips
 * `NcContext.is_public`, so the two must stay in lockstep — the invariant
 * `is_public === true` ⟺ a share source is asserted per entry point in the
 * unit suite.
 */
export interface ShareUuidParams {
  publicDataUuid?: string;
  sharedViewUuid?: string;
  sharedBaseUuid?: string;
  sharedDocUuid?: string;
}

/**
 * Which share surface a set of route params represents, or `undefined` for a
 * normal authenticated request. `publicDataUuid` names the legacy public
 * data-export route and is a shared VIEW uuid too, so it maps to the same
 * source. Pass `viewType` once the view is resolved to get `SHARED_FORM` rather
 * than the coarser `SHARED_VIEW`.
 */
export function resolveShareAccessSource(
  params: ShareUuidParams,
  viewType?: ViewTypes,
): NcAccessSource | undefined {
  if (params.sharedViewUuid || params.publicDataUuid) {
    return viewType === ViewTypes.FORM
      ? NcAccessSource.SHARED_FORM
      : NcAccessSource.SHARED_VIEW;
  }

  if (params.sharedBaseUuid) return NcAccessSource.SHARED_BASE;

  if (params.sharedDocUuid) return NcAccessSource.SHARED_DOC;

  return undefined;
}

/**
 * True when the request arrived through an anonymously published single view
 * (grid/gallery/… or form) — the gate for shared-view-only exposure rules,
 * notably the LTAR related-table restriction.
 *
 * NOT `context.is_public`: a shared BASE sets that too but is an authenticated
 * pseudo-user (`BaseViewStrategy` resolves `xc-shared-base-id` into a user with
 * the share's roles) and keeps full access. Reads positively, so an entry point
 * that forgets `access_source` fails OPEN — the invariant test in
 * `hiddenFieldMatrix/access-source.spec.ts` guards that, not a default here.
 */
export function isSharedViewAccess(context: Pick<NcContext, 'access_source'>) {
  return SHARED_VIEW_ACCESS_SOURCES.includes(context?.access_source);
}

// Share roles that can't write stored data: view filters, sorts or row values.
const SHARED_BASE_READ_ONLY_ROLES = [
  ProjectRoles.VIEWER,
  ProjectRoles.COMMENTER,
];

/**
 * Whether a stored condition (view filter or sort, link condition, RLS policy)
 * compiles as for a signed-in user, so user formulas compare on emails.
 *
 * A shared-base session that can edit (a legacy editor share) can write view
 * filters, sorts and row values, so it could pick the email being compared;
 * those compile on the public model there. Viewer and commenter shares (the
 * default) can't write any of it, so the values compared are the members',
 * and they keep emails to see what a signed-in member sees — narrowing them
 * would close nothing. RLS policies no session can edit, so they keep emails.
 *
 * An allow-list of read-only roles, so a missing or unknown share role falls
 * back to the public model rather than giving an editor share emails.
 */
export function compilesStoredConditionWithEmails(
  context: Pick<NcContext, 'access_source' | 'user'>,
  isRlsPolicyCondition = false,
) {
  if (isRlsPolicyCondition) return true;
  if (context?.access_source !== NcAccessSource.SHARED_BASE) return true;

  const shareRoles = extractRolesObj(context.user?.base_roles) ?? {};
  return SHARED_BASE_READ_ONLY_ROLES.some((role) => shareRoles[role]);
}
