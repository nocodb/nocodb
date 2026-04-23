import type { NcRequest } from '~/interface/config';
import ApiTokenScope from '~/ee/models/ApiTokenScope';

/**
 * Resource filter derived from a fine-grained API token's scopes.
 *
 * When `null`, no filtering should be applied (legacy token, JWT user,
 * or a fine-grained token with "all resources" scope).
 *
 * When an object, list endpoints should filter results to only resources
 * matching the included `baseIds` or `workspaceIds`.
 */
export interface PatResourceFilter {
  baseIds: string[];
  workspaceIds: string[];
}

/**
 * Derive a resource filter from the request's authenticated user.
 *
 * Returns `null` in any of these cases (no filtering required):
 * - Request is not authenticated by an API token (JWT user)
 * - The API token is a legacy token (no fine-grained scopes)
 * - The token has an "all resources" sentinel scope
 *
 * Returns `{ baseIds, workspaceIds }` only for fine-grained tokens scoped
 * to specific bases/workspaces.
 */
export async function getPatResourceFilter(
  req: NcRequest,
): Promise<PatResourceFilter | null> {
  const user = req?.user as any;

  // Not an API token request (JWT user)
  if (!user?.is_api_token) return null;

  const tokenId = user?.api_token_meta?.id;

  // Legacy token — no fine-grained scopes
  if (!tokenId) return null;

  const scopes = await ApiTokenScope.listByTokenId(tokenId);

  // Deny-by-default: fine-grained token should always have at least one scope
  if (!scopes.length) return null;

  // "All resources" sentinel → no filtering
  if (scopes.some((s) => (s.resource_type as string) === 'all')) return null;

  const baseIds: string[] = [];
  const workspaceIds: string[] = [];

  for (const s of scopes) {
    if (s.resource_type === 'base') baseIds.push(s.resource_id);
    else if (s.resource_type === 'workspace')
      workspaceIds.push(s.resource_id);
  }

  return { baseIds, workspaceIds };
}
