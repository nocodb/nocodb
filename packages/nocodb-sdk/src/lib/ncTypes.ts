import type { Request } from 'express';
import type { TableType, UserType } from '~/lib/Api';
import { NcApiVersion } from './enums';

export type NcContextTriggeredVia = 'undo' | 'redo' | 'sandbox-merge';

export interface NcContext {
  org_id?: string;
  workspace_id: string;
  base_id: string;
  api_version?: NcApiVersion;
  user?: UserType & {
    base_roles?: Record<string, boolean>;
    workspace_roles?: Record<string, boolean>;
    provider?: string;
    direct_teams?: { team_id: string; path: string }[];
  };
  fk_model_id?: string;
  socket_id?: string;
  /**
   * Per-tab UUID propagated from the GUI via the `x-nc-tab-id` request header.
   * Used to scope per-tab server-side state (e.g. undo/redo) so Cmd-Z in tab A
   * doesn't see edits made in tab B by the same user.
   */
  tab_id?: string;
  nc_site_url?: string;
  timezone?: string;
  suppressDependencyEvaluation?: boolean;
  additionalContext?: NcAdditionalContext;
  schema_locked?: boolean;
  cache?: boolean;
  cacheMap?: any;
  permissions?: any;
  is_api_token?: boolean;
  is_public?: boolean;
  /**
   * Set by replay dispatchers when running an undo / redo / sandbox-merge.
   */
  triggered_via?: NcContextTriggeredVia;
}

/**
 * Optional bag of cross-cutting flags threaded down the call chain via
 * `NcContext`. Keep this list short and named — adding a key here is the
 * preferred way to flow request-scoped state into deep model code without
 * resorting to globals or AsyncLocalStorage.
 *
 * `[key: string]: unknown` keeps the door open for ad-hoc additions, but
 * new in-tree usage should declare a typed key here so reads at the model
 * layer don't require casts.
 */
export interface NcAdditionalContext {
  /**
   * Set inside the date-dependency propagation loop to break recursion —
   * downstream BaseModel ops skip propagating again when this is true.
   */
  isDatePropagating?: boolean;
  /** Allow ad-hoc keys without forcing every caller through this interface. */
  [key: string]: unknown;
}

export interface NcRequest extends Partial<Request> {
  context: NcContext;
  ncSocketId?: string;
  ncTabId?: string;
  ncWorkspaceId?: string;
  ncBaseId?: string;
  ncSourceId?: string;
  ncParentAuditId?: string;
  /**
   * Shared view / form UUID-resolved id for unauthenticated public requests.
   * Captured into `nc_audit.fk_ref_id` so anonymous (ANONYMOUS_USER) submissions
   * remain traceable to the form/view they came through.
   */
  ncSharedViewId?: string;
  ncModel?: TableType;
  user: UserType & {
    base_roles?: Record<string, boolean>;
    workspace_roles?: Record<string, boolean>;
    provider?: string;
    is_api_token?: boolean;
    direct_teams?: { team_id: string; path: string }[];
  };
  ncSiteUrl: string;
  dashboardUrl: string;
  clientIp?: string;
  query?: Record<string, any>;
  skipAudit?: boolean;
}

export type NcRecord<T = any> = Record<string, T>;
