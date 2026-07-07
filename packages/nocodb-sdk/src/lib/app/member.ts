/**
 * App membership — an app is a first-class access resource.
 *
 * A member is a user or team assigned DIRECTLY to an app (stored in
 * `nc_principal_assignments` with `resource_type='app'`, the tier in `roles`),
 * decoupled from base/workspace membership. This is what lets an external
 * app-only collaborator — a `no-access` workspace member with zero base/data
 * access — be granted app access. App members are seat-free (seat counting
 * only considers workspace/base/team assignments).
 *
 * The tier is capped at EDITOR (apps escalate data verbs, never schema/member
 * management). For a member with no base role, the tier becomes the synthesized
 * runner `base_roles` at invoke; the write-gate is the ceiling.
 */
export enum AppMemberRole {
  VIEWER = 'viewer',
  EDITOR = 'editor',
}

export const APP_MEMBER_ROLES: AppMemberRole[] = [
  AppMemberRole.VIEWER,
  AppMemberRole.EDITOR,
];

export interface AppMemberType {
  /** Whether the member is an individual user or a team. */
  principal_type: 'user' | 'team';
  /** The user id or team id. */
  principal_id: string;
  /** Access tier. */
  role: AppMemberRole;
  /** User identity (present when principal_type === 'user'). */
  email?: string;
  display_name?: string;
  /** Team identity (present when principal_type === 'team'). */
  title?: string;
  created_at?: string;
}
