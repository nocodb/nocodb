/**
 * Explicit app access — the people (users/teams) named on an app's `APP_USE`
 * permission allow-list, on top of the base-members threshold. Presence in the
 * list means "allowed to open this app"; capability inside the app is always
 * the person's real base role (there is no app-level role). External
 * collaborators appear here as App Users with a base role.
 */
export interface AppMemberType {
  /** Whether the member is an individual user or a team. */
  principal_type: 'user' | 'team';
  /** The user id or team id (the APP_USE subject id). */
  principal_id: string;
  /** User identity (present when principal_type === 'user'). */
  email?: string;
  display_name?: string;
  /** Team identity (present when principal_type === 'team'). */
  title?: string;
  /** Team reach — whether sub-teams are included (present for teams). */
  hierarchy_scope?: 'self_only' | 'self_and_descendants';
  /** Resolved base role, shown for information (present for users). */
  base_role?: string;
  /** True when the user is a workspace App User (external, apps-only). */
  is_app_user?: boolean;
  /** Per-app role for external collaborators: viewer|commenter|editor. */
  app_role?: string;
  created_at?: string;
}
