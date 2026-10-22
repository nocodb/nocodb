import type { NcRequest } from '~/interface/config';
import { ApiToken } from '~/models';
import { getPatResourceFilter } from '~/helpers/patResourceFilter';
import { checkOAuthResourceAccess } from '~/mcp/oauth-scope-guard';

export interface CredentialBaseTarget {
  baseId: string;
  workspaceId: string;
}

export type CredentialBaseCheck = (
  target: CredentialBaseTarget,
) => Promise<boolean> | boolean;

// Symbol-keyed so it survives `{ ...req }` but never reaches JSON or the wire.
const CREDENTIAL_BASE_SCOPE = Symbol('ncCredentialBaseScope');

type ScopedRequest = { [CREDENTIAL_BASE_SCOPE]?: CredentialBaseCheck };

interface CredentialUser {
  id?: string;
  is_api_token?: boolean;
  api_token_meta?: { id?: string };
  is_oauth_token?: boolean;
  oauth_permissions?: string | null;
  oauth_granted_resources?: Record<string, any> | null;
}

/**
 * Bound a request to the bases its credential reaches. For the MCP surfaces,
 * whose `req.user` is rebuilt by `User.getWithRoles` and no longer names the
 * credential.
 */
export function bindCredentialBaseScope(
  req: object,
  check: CredentialBaseCheck,
) {
  (req as ScopedRequest)[CREDENTIAL_BASE_SCOPE] = check;
}

function oauthRefusal(user: CredentialUser, target: CredentialBaseTarget) {
  return checkOAuthResourceAccess(
    {
      fk_user_id: user.id ?? '',
      permissions: user.oauth_permissions ?? null,
      granted_resources: user.oauth_granted_resources ?? null,
    },
    { base_id: target.baseId, workspace_id: target.workspaceId },
  );
}

/** Bind the OAuth consent on `oauthUser` before `req.user` is replaced. */
export function bindOAuthBaseScope(req: object, oauthUser: CredentialUser) {
  bindCredentialBaseScope(
    req,
    (target) => oauthRefusal(oauthUser, target) === null,
  );
}

/**
 * Whether the credential behind `req` reaches `target`: a PAT (legacy
 * `base_id` or scope rows), an OAuth consent, or a bound MCP grant. A session
 * with no credential is bounded only by roles.
 */
export async function credentialCoversBase(
  req: NcRequest | undefined,
  target: CredentialBaseTarget,
): Promise<boolean> {
  if (!req) return true;

  const user = req.user as CredentialUser | undefined;

  if (user?.is_api_token) {
    const tokenId = user.api_token_meta?.id;
    const apiToken = tokenId ? await ApiToken.get(tokenId) : null;
    if (apiToken?.base_id && apiToken.base_id !== target.baseId) return false;

    const patFilter = await getPatResourceFilter(req);
    if (
      patFilter &&
      !patFilter.baseIds.includes(target.baseId) &&
      !patFilter.workspaceIds.includes(target.workspaceId)
    ) {
      return false;
    }
  }

  if (user?.is_oauth_token && oauthRefusal(user, target)) return false;

  const bound = (req as ScopedRequest)[CREDENTIAL_BASE_SCOPE];
  if (bound && !(await bound(target))) return false;

  return true;
}
