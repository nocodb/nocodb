/**
 * Preview-as ("view as") — a privileged user asks the server to evaluate a
 * request as another principal via the `xc-preview-as` header. The server
 * validates the caller's REAL role before honoring it (fail-closed: the
 * header is ignored for callers who may not preview), so the header itself
 * grants nothing.
 *
 * Wire format (single header value):
 *   user:<userId>   — evaluate as that user (identity swap; server blocks writes)
 *   role:<role>     — caller keeps their own identity with the given base role
 *   team:<teamId>   — caller keeps their own identity with that team's grants
 *
 * Scopes and authorization are decided server-side per surface (interface
 * preview-as: base owner/creator; base-wide view-as: base owner).
 */

export const NC_PREVIEW_AS_HEADER = 'xc-preview-as';

export type PreviewAsTargetType = 'user' | 'role' | 'team';

export interface PreviewAsTarget {
  type: PreviewAsTargetType;
  /** user id for `user`, team id for `team`, a `PREVIEW_AS_ROLES` value for `role` */
  value: string;
}

/**
 * Roles allowed as `role:` targets — plain string literals (matching
 * `ProjectRoles` values) so this stays safe to import at module top level.
 * Owner/creator previews are pointless (that is the caller's own view) and
 * stay unsupported.
 */
export const PREVIEW_AS_ROLES: readonly string[] = [
  'editor',
  'commenter',
  'viewer',
];

const PREVIEW_AS_HEADER_REGEX = /^(user|role|team):([\w-]{1,64})$/;

export function formatPreviewAsHeader(target: PreviewAsTarget): string {
  return `${target.type}:${target.value}`;
}

/**
 * Strict parse of the header value. Returns null for anything malformed —
 * callers treat null as "no preview requested" (fail-closed to self).
 */
export function parsePreviewAsHeader(
  value?: string | null
): PreviewAsTarget | null {
  if (!value || typeof value !== 'string') return null;

  const match = PREVIEW_AS_HEADER_REGEX.exec(value.trim());
  if (!match) return null;

  const [, type, targetValue] = match;
  if (type === 'role' && !PREVIEW_AS_ROLES.includes(targetValue)) return null;

  return { type: type as PreviewAsTargetType, value: targetValue };
}
