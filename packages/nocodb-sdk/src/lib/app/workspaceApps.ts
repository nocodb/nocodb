export type WorkspaceAppKind = 'ai' | 'classic';

/** One app on the workspace Apps tab: an AI app or a classic app (interface). */
export interface WorkspaceAppItem {
  kind: WorkspaceAppKind;
  id: string;
  base_id: string;
  /** Only for people in the project; an app user never learns it. */
  base_title?: string;
  title: string;
  /** Icon and color, for classic apps. */
  meta?: Record<string, any> | null;
  /** AI: has a live version. Classic: published and not hidden. */
  is_live: boolean;
  /** Opens as an app for this person; a builder also sees apps where this is false. */
  can_open: boolean;
  /** AI: when the live version was built. Classic: last publish. */
  live_at?: string | null;
  updated_at?: string | null;
  /** Owner or creator of the app's project. */
  can_edit: boolean;
}
