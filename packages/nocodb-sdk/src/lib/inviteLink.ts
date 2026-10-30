// Shareable invite links, for a base, a whole workspace, one interface or one
// app.
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
  INTERFACE = 'interface',
  APP = 'app',
}

/**
 * Roles a link may grant, per scope. Owner is deliberately absent from both: a
 * link hands access to whoever holds the URL, and that is never the right way
 * to transfer ownership.
 *
 * No Access and Inherit grant nothing: a redeemer who is new to the workspace
 * inherits no-access, and one who is already a member already had that role.
 */
export const BASE_INVITE_LINK_ROLES = [
  ProjectRoles.CREATOR,
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

/**
 * Interface links use the base-role vocabulary and are mapped to interface
 * roles (ProjectRolesToInterfaceRoles) when redeemed, as the interface member
 * UI does for display.
 */
export const INTERFACE_INVITE_LINK_ROLES = [
  ProjectRoles.EDITOR,
  ProjectRoles.COMMENTER,
  ProjectRoles.VIEWER,
] as const;

/**
 * App access is App Team membership, not a role: an app link names its team in
 * `fk_app_team_id`, and `role` only records the base standing a redeemer gets.
 */
export const APP_INVITE_LINK_ROLES = [ProjectRoles.APP_USER] as const;

export type BaseInviteLinkRole = (typeof BASE_INVITE_LINK_ROLES)[number];
export type WorkspaceInviteLinkRole =
  (typeof WORKSPACE_INVITE_LINK_ROLES)[number];
export type InviteLinkRole = BaseInviteLinkRole | WorkspaceInviteLinkRole;

export const inviteLinkRolesFor = (
  scope: InviteLinkScope
): readonly InviteLinkRole[] => {
  switch (scope) {
    case InviteLinkScope.WORKSPACE:
      return WORKSPACE_INVITE_LINK_ROLES;
    case InviteLinkScope.INTERFACE:
      return INTERFACE_INVITE_LINK_ROLES;
    case InviteLinkScope.APP:
      return APP_INVITE_LINK_ROLES;
    default:
      return BASE_INVITE_LINK_ROLES;
  }
};

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

export type InviteLinkUnusableReason =
  /** The minter no longer holds the role the link grants. */
  | 'minter_role'
  /** The role is no longer one a link may grant (e.g. inherit). */
  | 'retired_role'
  /** The base is private, or gone, and the minter is not its owner. */
  | 'private_base'
  /** The app team the link adds people to was deleted. */
  | 'team_removed'
  /** Every allowed use has been taken. */
  | 'exhausted'
  /** Past its expiry date. */
  | 'expired';

export interface InviteLinkType {
  id?: string;
  scope?: InviteLinkScope;
  base_id?: string | null;
  fk_workspace_id?: string | null;
  /** Set for interface links; `base_id` is then the interface's base. */
  fk_interface_id?: string | null;
  /** Set for app links; `base_id` is then the app's base. */
  fk_app_id?: string | null;
  /** The app team an app link adds its redeemer to. */
  fk_app_team_id?: string | null;
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
  /**
   * Who minted the link, resolved for display. Attached by `list` only: below
   * creator a caller sees only their own links, but a manager scanning ten of
   * them needs to know whose each one is.
   */
  created_by_email?: string;
  created_by_display_name?: string;
  /**
   * Absent means the link works. `false` means it is intact but will not be
   * honoured: its minter no longer holds the role it grants (demoted, removed),
   * or its base went private under a minter who is not the owner. Dormant
   * rather than dead -- restoring the minter's role or making the base public
   * again brings it back, which is why these stay listed.
   */
  usable?: boolean;
  /** Why `usable` is false, so the list can say what would fix it. */
  unusable_reason?: InviteLinkUnusableReason;
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
  /** App links only: the team the link adds people to. */
  fk_app_team_id?: string;
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
  | 'domain_mismatch'
  /**
   * Intact, but will not be honoured: base deleted or made private, or the
   * minter no longer holds the role the link grants.
   */
  | 'unavailable';

/** What a holder of the token is allowed to learn before redeeming it. */
export interface InviteLinkPreviewType {
  scope?: InviteLinkScope;
  /** Base, workspace, interface or app title, per scope. */
  target_title?: string;
  role?: InviteLinkRole;
  /** App links: the team on offer, shown in place of the role. */
  team_title?: string;
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
  interface_id?: string | null;
  app_id?: string | null;
}
