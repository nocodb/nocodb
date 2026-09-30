export interface OAuthResourceToken {
  fk_user_id: string;
  permissions?: string | null;
  granted_resources?: Record<string, any> | null;
}

export interface OAuthResourceContext {
  workspace_id?: string;
  base_id?: string;
}

/**
 * CE has no scope rows, so a grant is bounded only by `granted_resources`.
 *
 * Returns a refusal message, or null when the request may proceed.
 */
export function checkOAuthResourceAccess(
  token: OAuthResourceToken,
  ctx: OAuthResourceContext,
): string | null {
  const granted = token.granted_resources;
  if (!granted) return null;

  if (granted.workspace_id && ctx.workspace_id !== granted.workspace_id) {
    return 'OAuth token access limited to specific workspace';
  }

  if (granted.base_id && ctx.base_id !== granted.base_id) {
    return 'OAuth token access limited to specific base';
  }

  return null;
}
