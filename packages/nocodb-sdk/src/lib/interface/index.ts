import type {
  AnyInterfacePageConfig,
  InterfacePageConfigFor,
} from './pageConfigs';
import { InterfacePageLayoutTypes, InterfacePageVisualVariants } from './enums';

/** Chrome styles for the end-user app shell (nav/frame treatment). */
export type InterfaceThemeStyle = 'bold' | 'quiet' | 'framed' | 'wash' | 'ink';

/** Per-interface theme — applies to the end-user app shell. */
export interface InterfaceThemeConfig {
  /** Curated accent palette key (not a raw hex). */
  accent?: string | null;
  style?: InterfaceThemeStyle | null;
  /** Forces the app light/dark while inside this interface. */
  mode?: 'auto' | 'light' | 'dark' | null;
}

/** Interface meta (icon/color etc.) — stored as JSON in `nc_interfaces.meta`. */
export interface InterfaceMetaType {
  icon?: string | null;
  color?: string | null;
  theme?: InterfaceThemeConfig | null;
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
}

export type AnyInterfacePageType =
  InterfacePageType<InterfacePageLayoutTypes>;

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
