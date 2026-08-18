import type {
  AnyInterfacePageConfig,
  InterfacePageConfigFor,
} from './pageConfigs';
import type { InterfaceRoles } from '../enums';
import type { SubjectHierarchyScope } from '../permission';
import { InterfacePageLayoutTypes, InterfacePageVisualVariants } from './enums';

/** Chrome styles for the end-user app shell (nav/frame treatment). */
export type InterfaceThemeStyle = 'bold' | 'quiet' | 'framed' | 'wash' | 'ink';

/** Per-interface theme — applies to the end-user app shell. */
export interface InterfaceThemeConfig {
  /** Curated accent palette key (not a raw hex). */
  accent?: string | null;
  style?: InterfaceThemeStyle | null;
}

/** Interface meta (icon/color etc.) — stored as JSON in `nc_interfaces.meta`. */
export interface InterfaceMetaType {
  icon?: string | null;
  color?: string | null;
  theme?: InterfaceThemeConfig | null;
  /**
   * when on, only base
   * collaborators may share this interface — interface-only collaborators
   * lose grant management (server-enforced).
   */
  restrict_sharing?: boolean;
}

export interface InterfaceType {
  id?: string;
  title: string;
  description?: string;
  base_id: string;
  fk_workspace_id?: string;
  meta?: InterfaceMetaType | null;
  hidden?: boolean;
  order?: number;
  first_published_at?: string | null;
  last_published_at?: string | null;
  created_by?: string;
  owned_by?: string;
  created_at?: string;
  updated_at?: string;
  /**
   * Requesting user's effective interface role, resolved server-side
   * (page/interface grants + base-role fallback). Absent for base builders
   * (owner/creator), who have full access.
   */
  effective_role?: InterfaceRoles;
}

/** One collaborator (user principal) of an interface, as shown in share/manage UIs. */
export interface InterfaceUserType {
  id: string;
  email: string;
  display_name?: string | null;
  meta?: Record<string, any> | string | null;
  /** Explicit interface-level grant; absent when access is base-role-derived. */
  interface_role?: InterfaceRoles | null;
  /** Resolved role after inheritance (grant or base-role-derived). */
  effective_role?: InterfaceRoles | null;
  /** Where the effective role comes from. */
  role_source?: 'interface-grant' | 'team-grant' | 'base-role' | 'builder';
  /** Explicit page-level overrides (pageId → role); absence = Inherited. */
  page_roles?: Record<string, InterfaceRoles>;
  /** Invite pending (user never signed up). */
  invite_pending?: boolean;
  /**
   * Team rows only: descendant expansion of the interface-level grant —
   * absent means 'self_and_descendants' (permission-subject parity).
   */
  hierarchy_scope?: SubjectHierarchyScope;
}

/** One row of the base-wide users-management matrix. */
export interface InterfaceUsersMatrixRow {
  /**
   * The principal — a user, or (with `is_team`) a team riding the same
   * carrier (`id` = team id, `display_name` = team title, `email` empty).
   */
  user: Pick<
    InterfaceUserType,
    | 'id'
    | 'email'
    | 'display_name'
    | 'meta'
    | 'invite_pending'
  >;
  /** True when the user is base owner/creator — full access, not editable here. */
  is_builder?: boolean;
  /** Which base role qualifies them as a builder — drives the badge label. */
  builder_base_role?: 'owner' | 'creator';
  /** True when the row's principal is a team (explicit team grants only). */
  is_team?: boolean;
  interfaces: Array<{
    interface_id: string;
    interface_role?: InterfaceRoles | null;
    effective_role?: InterfaceRoles | null;
    role_source?: InterfaceUserType['role_source'];
    page_roles?: Record<string, InterfaceRoles>;
    /** Team rows only: descendant expansion of the interface-level grant. */
    hierarchy_scope?: SubjectHierarchyScope;
    /**
     * User rows only: teams whose grant on this interface (or its pages)
     * reaches this user — the provenance behind a derived role.
     */
    via_teams?: Array<{ id: string; title: string | null }>;
  }>;
}

export interface InterfacePageType<
  L extends InterfacePageLayoutTypes = InterfacePageLayoutTypes
> {
  id?: string;
  fk_interface_id: string;
  title: string;
  layout: L;
  /** Source table — null for OVERVIEW. */
  fk_model_id?: string | null;
  /** Page appearance meta (icon etc.).*/
  meta?: InterfaceMetaType | null;
  /** false = unparented (record-detail pages, modal record forms). */
  show_in_nav?: boolean;
  visual_variant?: InterfacePageVisualVariants;
  /** Draft config — live-edited by builders. */
  config?: InterfacePageConfigFor<L> | null;
  /** Consumer-rendered config — written by publish. */
  published_config?: InterfacePageConfigFor<L> | null;
  is_published?: boolean;
  /** Exclude this page from the next publish. */
  keep_as_draft?: boolean;
  draft_modified_at?: string | null;
  published_at?: string | null;
  /** Dependency-validation flag (broken column/page references). */
  error?: boolean;
  /** Public share-to-web (page-level, read-only). */
  uuid?: string | null;
  password?: string | null;
  order?: number;
  base_id: string;
  fk_workspace_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  /**
   * Requesting user's effective role ON THIS PAGE, resolved server-side
   * (page grant → interface grant → base-role fallback). Absent for base
   * builders (owner/creator), who have full access.
   */
  effective_role?: InterfaceRoles;
}

export type AnyInterfacePageType = InterfacePageType<InterfacePageLayoutTypes>;

/**
 * Default (empty but valid) config per layout — used at page creation.
 */
export function getDefaultInterfacePageConfig<
  L extends InterfacePageLayoutTypes
>(layout: L): InterfacePageConfigFor<L> {
  const defaults: {
    [K in InterfacePageLayoutTypes]: InterfacePageConfigFor<K>;
  } = {
    [InterfacePageLayoutTypes.TABLE]: {
      visualizations: [],
    },
    [InterfacePageLayoutTypes.RECORD_REVIEW]: {
      list: { item: {} },
      detail: { groups: [] },
    },
    [InterfacePageLayoutTypes.DASHBOARD]: {
      groups: [],
    },
    [InterfacePageLayoutTypes.FORM]: {
      groups: [],
    },
    [InterfacePageLayoutTypes.OVERVIEW]: {
      blocks: [],
      sidebar_blocks: [],
    },
    [InterfacePageLayoutTypes.RECORD_DETAIL]: {
      groups: [],
    },
    [InterfacePageLayoutTypes.CUSTOM]: {
      sources: [],
    },
  };

  return defaults[layout];
}

export function parseInterfaceMeta(
  meta: InterfaceMetaType | string | null | undefined
): InterfaceMetaType {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta) as InterfaceMetaType;
    } catch {
      return {};
    }
  }
  return meta;
}

export type { AnyInterfacePageConfig, InterfacePageConfigFor };

export * from './enums';
export * from './elements';
export * from './pageConfigs';
export * from './vizFields';
export * from './copyFromView';
