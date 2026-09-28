import type { Request } from 'express';
import type { TableType, UserType } from '~/lib/Api';
import { NcAccessSource, NcApiVersion, ProjectRoles } from './enums';

export type NcContextTriggeredVia = 'undo' | 'redo' | 'environment-promote';

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
    /**
     * Set together on an app runner: `base_roles` is then a fixed capability
     * floor, so anything thresholding a ROLE must read `real_base_role`
     * instead — use `getStandingRole()` rather than testing this by hand.
     */
    is_app_effective_role?: boolean;
    real_base_role?: ProjectRoles;
    is_agent?: boolean;
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
  /**
   * Active environment id (development / staging / production …). Determines
   * which integration config is resolved at runtime (see Environment /
   * IntegrationEnvConfig). Unset → the default (production) config. This is
   * server-pinned per deployment for live apps; it is never client-settable.
   */
  environment?: string;
  /**
   * The managed app whose APP-SCOPED team memberships are visible in this
   * context. Set ONLY inside the app runner (resolveAppRunner) from the live
   * scope's app id; unset everywhere else. When set, `PrincipalAssignment`
   * team-membership reads additionally surface rows tagged with this
   * `fk_app_id` (a user added to a team "through the app"), so page-access and
   * RLS resolve those memberships consistently — but only within the app.
   * When unset, app-scoped rows are invisible to every read, so they never
   * leak into workspace team management, real `direct_teams`, or non-app RLS.
   */
  app_scope_id?: string;
  suppressDependencyEvaluation?: boolean;
  additionalContext?: NcAdditionalContext;
  schema_locked?: boolean;
  cache?: boolean;
  cacheMap?: any;
  permissions?: any;
  is_api_token?: boolean;
  /**
   * True for ANY share surface. Derived, kept for the existing behavioural
   * readers (after-hook suppression, user-column redaction). Prefer
   * `access_source` when a gate needs to tell one share surface from another.
   */
  is_public?: boolean;
  /**
   * Which surface this request arrived through — see {@link NcAccessSource}.
   * Left unset for contexts built outside the request middleware, so gates must
   * test for the specific source they restrict rather than for its absence.
   *
   * Invariant, asserted per entry point in the unit suite:
   * `is_public === true` ⟺ `SHARED_ACCESS_SOURCES.includes(access_source)`.
   */
  access_source?: NcAccessSource;
  /**
   * Set by replay dispatchers when running an undo / redo / environment-promote.
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
   * The action capability an app-action dispatch already admitted this call on.
   * Server-set on the synthetic request in `_run`; never read off the wire.
   */
  ncActionCapability?: string;
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
    is_agent?: boolean;
  };
  ncSiteUrl: string;
  dashboardUrl: string;
  /** Base permission rows, loaded once by the ACL middleware. */
  permissions?: any;
  clientIp?: string;
  query?: Record<string, any>;
  skipAudit?: boolean;
}

export type NcRecord<T = any> = Record<string, T>;
