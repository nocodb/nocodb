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
/**
 * Owner and No Access stay out: one is never handed out by a link, the other
 * grants nothing.
 *
 * Inherit is safe here because it defers to the role the redeemer already holds
 * at workspace level rather than granting a new one, and links are refused on
 * private bases, so there is no base they could reach this way that their
 * workspace role did not already reach.
 */
export const BASE_INVITE_LINK_ROLES = [
  ProjectRoles.CREATOR,
  ProjectRoles.INHERIT,
  ProjectRoles.EDITOR,
  ProjectRoles.COMMENTER,
  ProjectRoles.VIEWER,
  ProjectRoles.APP_USER,
] as const;

export const WORKSPACE_INVITE_LINK_ROLES = [
  WorkspaceUserRoles.CREATOR,
  WorkspaceUserRoles.EDITOR,
  WorkspaceUserRoles.COMMENTER,
  WorkspaceUserRoles.VIEWER,
] as const;

export type BaseInviteLinkRole = (typeof BASE_INVITE_LINK_ROLES)[number];
export type WorkspaceInviteLinkRole =
  (typeof WORKSPACE_INVITE_LINK_ROLES)[number];
export type InviteLinkRole = BaseInviteLinkRole | WorkspaceInviteLinkRole;

export const inviteLinkRolesFor = (
  scope: InviteLinkScope
): readonly InviteLinkRole[] =>
  scope === InviteLinkScope.WORKSPACE
    ? WORKSPACE_INVITE_LINK_ROLES
    : BASE_INVITE_LINK_ROLES;

export const isInviteLinkRole = (
  scope: InviteLinkScope,
  role: unknown
): role is InviteLinkRole =>
  (inviteLinkRolesFor(scope) as readonly unknown[]).includes(role);

/**
 * Default life of a new link, in days. `0` means it never expires, which is the
 * default: a link lives until it is revoked. Revocation is the control, not a
 * timer the creator never set and cannot see. Pass `expires_in_days` to ask for
 * a deadline.
 */
export const INVITE_LINK_DEFAULT_EXPIRY_DAYS = 0;

/**
 * Upper bound on a requested expiry. Exists so an out-of-range number cannot
 * reach the dateTime column as an Invalid Date; `0` (never expires) is still
 * the way to ask for an unbounded link.
 */
export const INVITE_LINK_MAX_EXPIRY_DAYS = 3650;

/**
 * Upper bound on a use cap. Same reason as the expiry bound: without it an
 * out-of-range number reaches an `integer` column and comes back as a driver
 * error rather than a validation message.
 */
export const INVITE_LINK_MAX_USES = 100000;

/** Longest `email_domain` the column accepts. */
export const INVITE_LINK_MAX_DOMAIN_LENGTH = 255;

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
  /**
   * Only for a signed-in caller who already holds the link's role or better:
   * there is nothing to redeem, so the page opens the target instead of asking
   * them to join. The ids are what that caller sees on landing anyway.
   */
  already_member?: boolean;
  base_id?: string | null;
  workspace_id?: string | null;
}
