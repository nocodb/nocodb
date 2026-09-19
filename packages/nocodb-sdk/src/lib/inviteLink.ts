// Shareable invite links, for a base or a whole workspace.
//
// Unlike `invite_token` on a base/workspace user — minted per invited email,
// 24h, consumed at signup — an invite link is a standing grant that anyone
// holding the URL can redeem. Everything here exists to keep that grant narrow:
// a capped role, an optional email domain, an optional expiry and use limit,
// and instant revocation.
//
// One shape covers both scopes so the token, the redeem route and the audit
// trail stay identical; only the role vocabulary and the membership row differ.

import { ProjectRoles, WorkspaceUserRoles } from '~/lib/enums';

export enum InviteLinkScope {
  BASE = 'base',
  WORKSPACE = 'workspace',
}

/**
 * Roles a link may grant, per scope. Owner is deliberately absent from both: a
 * link hands access to whoever holds the URL, and that is never the right way
 * to transfer ownership. `inherit` and `no-access` are meaningless for a link.
 */
export const BASE_INVITE_LINK_ROLES = [
  ProjectRoles.CREATOR,
  ProjectRoles.EDITOR,
  ProjectRoles.COMMENTER,
  ProjectRoles.VIEWER,
] as const;

export const WORKSPACE_INVITE_LINK_ROLES = [
  WorkspaceUserRoles.CREATOR,
  WorkspaceUserRoles.EDITOR,
  WorkspaceUserRoles.COMMENTER,
  WorkspaceUserRoles.VIEWER,
] as const;

export type BaseInviteLinkRole = (typeof BASE_INVITE_LINK_ROLES)[number];
export type WorkspaceInviteLinkRole = (typeof WORKSPACE_INVITE_LINK_ROLES)[number];
export type InviteLinkRole = BaseInviteLinkRole | WorkspaceInviteLinkRole;

export const inviteLinkRolesFor = (scope: InviteLinkScope): readonly InviteLinkRole[] =>
  scope === InviteLinkScope.WORKSPACE
    ? WORKSPACE_INVITE_LINK_ROLES
    : BASE_INVITE_LINK_ROLES;

export const isInviteLinkRole = (
  scope: InviteLinkScope,
  role: unknown
): role is InviteLinkRole =>
  (inviteLinkRolesFor(scope) as readonly unknown[]).includes(role);

/** How many live links one base or workspace may hold at once. */
export const INVITE_LINK_MAX_PER_SCOPE = 10;

/** Default life of a new link, in days. `0` means it never expires. */
export const INVITE_LINK_DEFAULT_EXPIRY_DAYS = 7;

export interface InviteLinkType {
  id?: string;
  scope?: InviteLinkScope;
  base_id?: string | null;
  fk_workspace_id?: string | null;
  role?: InviteLinkRole;
  /**
   * Restrict redemption to verified emails at this domain, e.g. `acme.io`.
   * Null means any email.
   */
  email_domain?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  used_count?: number;
  revoked_at?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  /**
   * The redeemable secret. Present only for callers entitled to manage the
   * link; never logged, never part of the public preview.
   */
  token?: string;
}

export interface InviteLinkReqType {
  role: InviteLinkRole;
  email_domain?: string | null;
  /** Days from now. Undefined means the default; 0 means never expires. */
  expires_in_days?: number | null;
  max_uses?: number | null;
}

export type InviteLinkInvalidReason =
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'exhausted'
  | 'domain_mismatch';

/** What a holder of the token is allowed to learn before redeeming it. */
export interface InviteLinkPreviewType {
  scope?: InviteLinkScope;
  /** Base title, or workspace title for a workspace link. */
  target_title?: string;
  role?: InviteLinkRole;
  email_domain?: string | null;
  /** Set when the link cannot be redeemed, so the page can say why. */
  invalid_reason?: InviteLinkInvalidReason;
}
