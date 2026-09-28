import type {
  DeploymentStatus,
  DeploymentType,
  ManagedAppVisibility,
} from '~/lib/globals';
import type { ProjectRoles } from '~/lib/enums';
import type { BaseVariableType } from '~/lib/base-variable';
import type { IntegrationCredentialMode } from '~/lib/integration-credential';
import type { AttachmentResType } from '~/lib/Api';
import { ManagedAppInstallSurface } from '~/lib/globals';

/**
 * Every reader goes through this — never read the column raw. Anything
 * unrecognised resolves to `APP`, the narrower of the two, and so does the
 * retired `data` surface: it was schema-locked, and reading it as `FULL` would
 * unlock installs that were never meant to be.
 */
export function resolveInstallSurface(
  value?: string | null
): ManagedAppInstallSurface {
  return value === ManagedAppInstallSurface.FULL
    ? value
    : ManagedAppInstallSurface.APP;
}

/** `ManagedAppType.categories` holds these keys; labels and icons resolve in
 *  the frontend. */
export enum ManagedAppCategory {
  CRM = 'crm',
  SALES = 'sales',
  MARKETING = 'marketing',
  FINANCE = 'finance',
  HR = 'hr',
  OPERATIONS = 'operations',
  SUPPORT = 'support',
  IT = 'it',
  PRODUCT = 'product',
  DATA = 'data',
  OTHER = 'other',
}

export interface ManagedAppType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  title?: string;
  /** Store card and search copy; plain text, max 140 chars. */
  tagline?: string;
  /** Rich overview rendered on the store detail page. */
  description?: string;
  created_by?: string;
  visibility?: ManagedAppVisibility;
  /** Never read raw: `resolveInstallSurface` reads a null (pre-column) row
   *  as `APP`. */
  install_surface?: ManagedAppInstallSurface;
  categories?: ManagedAppCategory[];
  install_count?: number;
  meta?: Record<string, any>;
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  fk_publisher_id?: string;
  /** Never re-minted, so a retitled app keeps the URL people shared. */
  slug?: string;
  cover?: string;
  screenshots?: string;
  delisted?: boolean;
  /** Never cleared — `published_at` is re-stamped by unpublish/republish and
   *  cannot serve as a first-publish date. */
  first_published_at?: string;
  last_release_at?: string;
  latest_version?: string;
  latest_version_id?: string;
  has_agents?: boolean;
  table_count?: number;
  action_count?: number;
  automation_count?: number;
  ai_field_count?: number;
}

/** A packaged team as frozen into a published version's teams manifest. */
export interface PackagedTeamManifestEntry {
  handle: string;
  title: string;
  duty?: string;
  base_role: ProjectRoles;
  /** What subjects in the snapshot reference; install remaps it. */
  source_team_id: string;
}

export interface ManagedAppVersionType {
  id?: string;
  fk_managed_app_id?: string;
  fk_workspace_id?: string;
  version?: string;
  version_number?: number;
  schema?: string;
  release_notes?: string;
  created_at?: string;
  updated_at?: string;
  /**
   * Never null on a row a reader can see: the row exists only once its publish
   * succeeded. Replaced a `status` column that could disagree with it.
   */
  published_at?: string;
}

export interface ManagedAppDeploymentLogType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_managed_app_id?: string;
  from_version_id?: string;
  to_version_id?: string;
  status?: DeploymentStatus;
  deployment_type?: DeploymentType;
  error_message?: string;
  deployment_log?: string;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface ManagedAppReqType {
  title: string;
  tagline?: string;
  description?: string;
  visibility?: ManagedAppVisibility;
  install_surface?: ManagedAppInstallSurface;
  categories?: ManagedAppCategory[];
}

/**
 * The unit an action binds and an installer connects. The app owns the slot, so
 * its key is stable for the app's whole life and an upgrade lines up against
 * what the installer already bound however often the actions were re-versioned.
 * `fk_integration_id` is the only tenant-scoped fact here, and the only one
 * publish blanks.
 */
export interface AppConnectionSlotType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_app_id?: string;
  /** Stable key, unique per app — what `source_ref.connection.slot` names. */
  slot: string;
  /** The provider a connection must be for this slot to accept it. */
  sub_type: string;
  /** Installer-facing name — "Mailbox offers are sent from". */
  title: string;
  /** Why the app needs it; shown in the wizard and on the store listing. */
  purpose?: string | null;
  /** Null means either mode is accepted — the only case a bind may ignore. */
  required_credential_mode?: IntegrationCredentialMode | null;
  /** True when leaving it unbound is a degraded app rather than a broken one. */
  optional?: boolean;
  /** The binding. Null until someone holding the credential connects it. */
  fk_integration_id?: string | null;
  order?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * One connection an installer must bind. Six Calendar actions sharing a slot
 * are ONE row, and every pre-install surface counts these.
 */
export interface RebindManifestConnection {
  /** `AppConnectionSlotType.slot` — what a bind call selects on. */
  slot: string;
  subType: string;
  /** The publisher's own name for the connection. */
  title: string;
  purpose: string | null;
  /**
   * The kind's own name ("PostgreSQL") when `title` is the publisher's label.
   * Null when the two match, so a renderer can print it unconditionally.
   */
  providerName: string | null;
  iconSubType: string | null;
  requiredCredentialMode: IntegrationCredentialMode | null;
  optional: boolean;
  /** How many of the release's actions run on this connection. */
  actionCount: number;
}

/** What an installer must configure to make an installed app fully functional. */
export interface RebindManifest {
  connections: RebindManifestConnection[];
  /** Base-variable keys that are secret and shipped with a blank value. */
  secretVariableKeys: string[];
}

/** Install request payload for the managedAppInstall internal operation. */
export interface ManagedAppInstallReqType {
  managedAppId: string;
  target_workspace_id: string;
  /** Installer-chosen bindings: slot key → integrationId. */
  rebind?: { connections?: Record<string, string> };
}

/**
 * One integration-source action version and the slot it runs on. The binding
 * lives on the slot, so it is reported per connection, not per action.
 */
export interface ManagedAppSetupIntegrationEntry {
  /** id of the AppActionVersion. */
  routineVersionId: string;
  /** Human-facing action name (from the parent AppAction). */
  routineName: string;
  /** The capability this version runs (`source_ref.action`). */
  nodeSubType: string | null;
  /** The slot it binds — `AppConnectionSlotType.slot`. */
  slot: string;
}

/** An installer connection an installed app's action is bound to. */
export interface ManagedAppSetupBoundIntegration {
  id: string;
  title?: string;
  type?: string;
  sub_type?: string;
}

/**
 * A tenant-scoped authored value the installer's copy points at —
 * `bitbucket.workspace`, `zoho.portal_id`, `gitlab.projectId`.
 *
 * Derived from the capability manifest, never declared: publish keeps `source_ref`
 * verbatim and blanks only the slot's binding, so a required authored param still
 * carries the publisher's value until the installer overwrites it.
 *
 * Two deny rules bound it, because an installer may change what an action POINTS AT
 * but never what it DOES: the param must not be `repointable: false` (how `sql`,
 * `method` and `headers` say "I AM the action"), and its type must be a scalar,
 * which keeps a request-shaping `object` out by default.
 *
 * A name is collected when at least one capability in the group declares it
 * required, then written across every version declaring it.
 */
export interface ManagedAppSetupProviderParam {
  /** Authored param name, exactly as `source_ref` stores it. */
  name: string;
  /** Manifest param type — string/number/integer/boolean/enum/object/array. */
  type: string;
  description?: string;
  /** Allowed values, when the manifest declares the param as an enum. */
  values?: string[];
  /**
   * Whether either rebind op accepts this name. False for a required pointer the
   * collection rules deny — a non-scalar one such as `box.folder.create.parent`,
   * whose shape `CapabilityParam` cannot describe; render those read-only.
   *
   * Display only: the server derives what is writable independently, so a
   * `collectable: false` name is silently dropped rather than obeyed.
   */
  collectable: boolean;
  /** Action versions in this group that declare it. */
  routineVersionIds: string[];
  /** Distinct values currently stored across those versions. */
  currentValues: unknown[];
  /** True when those versions do not all carry the same value. */
  mixed: boolean;
  /** True when at least one declaring version carries no value at all. */
  unset: boolean;
}

/**
 * The unit the setup wizard asks about: an app with ten Slack actions on one
 * slot is one connection choice, not ten.
 */
export interface ManagedAppSetupProviderGroup {
  /** `AppConnectionSlotType.slot`, and what `managedAppRebindProvider` takes. */
  groupKey: string;
  /** The provider a connection must be for this slot to accept it. */
  subType: string;
  /** The slot's own title — what tells two PostgreSQL slots apart. */
  title: string;
  /** Why the app needs this connection, as the publisher described it. */
  purpose: string | null;
  /**
   * The kind's own name ("PostgreSQL") when `title` is the publisher's label.
   * Null when the two match, so a renderer can print it unconditionally.
   */
  providerName: string | null;
  /** Integration sub_type to render the provider icon from. */
  iconSubType: string | null;
  /**
   * What a picker filters on: the slot's own sub_type, plus the auth sub_type a
   * workflow-node namespace authenticates with where the two differ. sub_type
   * only, type-agnostic — `postgres-auth` qualifies, a Database-typed `pg` does
   * not.
   */
  acceptedSubTypes: string[];
  /**
   * The picker's second filter, beside `acceptedSubTypes`. Null means the release
   * recorded no intent — the one case a bind may ignore it.
   */
  requiredCredentialMode: IntegrationCredentialMode | null;
  /** True when an unbound slot is a degraded app rather than a broken one. */
  optional: boolean;
  /** Action versions that run on this slot. */
  routineVersionIds: string[];
  total: number;
  /** The connection this slot is bound to, null while it is unbound. */
  boundIntegration: ManagedAppSetupBoundIntegration | null;
  /** Tenant-scoped authored values setup collects alongside the connection. */
  params: ManagedAppSetupProviderParam[];
  /**
   * Collectable `params` missing a value on at least one declaring version — a
   * gap the installer can close. A `collectable: false` one is never counted
   * however unset it is: it would pin the group in a state no action clears.
   *
   * Not folded into `counts.integrationsPending` or `setupRequired`, which count
   * exactly one thing: an action version with no connection. A populated value
   * is not counted either — nothing stored says whether it is the publisher's or
   * the installer's, so it is offered for review, not asserted incomplete.
   */
  paramsUnset: number;
}

/** A packaged team as instantiated on the installer side, with staffing info. */
export interface ManagedAppSetupTeamEntry {
  id: string;
  title: string;
  handle: string;
  duty?: string;
  /** All team members, including the installer auto-added as team owner. */
  member_count: number;
}

/**
 * Drives the post-install wizard and the topbar "Finish setup" pill; computed
 * by the managedAppSetupStatus internal operation.
 */
export interface ManagedAppSetupStatusType {
  /** `meta`/`categories` come along so setup can draw the store's cover art. */
  app: {
    id: string;
    title?: string;
    categories: ManagedAppCategory[];
    meta?: Record<string, any>;
  };
  /** What `managedAppRebindProvider` takes as `appId`. `app.id` above is the
   *  STORE listing's id, a different entity. */
  installedAppId: string | null;
  /** Setup binds slots, not actions, so these are the record, not the control. */
  integrations: ManagedAppSetupIntegrationEntry[];
  /** The unit setup binds, and the unit `counts.integrationsPending` counts. */
  providers: ManagedAppSetupProviderGroup[];
  /** Base variables (masked/stripped by the service), setup-pending flagged. */
  variables: (BaseVariableType & { setupPending?: boolean })[];
  teams: ManagedAppSetupTeamEntry[];
  counts: {
    /** Required slots with no binding. An optional slot is never counted. */
    integrationsPending: number;
    variablesPending: number;
    teamsEmpty: number;
  };
  /** Hard items only: required slots unbound, or unset required/secret variables. */
  setupRequired: boolean;
}

/** Request payload for the managedAppRebindProvider internal operation. */
export interface ManagedAppRebindProviderReqType {
  /** `ManagedAppSetupStatusType.installedAppId`, checked against the base. */
  appId: string;
  /** `ManagedAppSetupProviderGroup.groupKey` — the slot to bind. */
  groupKey: string;
  integrationId: string;
  /**
   * `source_ref` is the authored half of the authored/input security boundary, so
   * a key is written only when the capability declares it, the param is
   * repointable and scalar, the value matches, and the slot collects the name.
   */
  params?: Record<string, unknown>;
}

/**
 * Whether the CONNECTION is acceptable is decided once for the slot and
 * refused as a 400, so everything here is about this version's authored values.
 */
export interface ManagedAppRebindProviderResultEntry {
  routineVersionId: string;
  routineName: string;
  /** `unchanged` = the binding and every value already matched. */
  status: 'bound' | 'unchanged' | 'failed';
  /**
   * Present only on `failed`. `not_an_integration_source` — the version does not
   * run on a connection, so there is nothing to write. `source_rejected` — the
   * authoring gate refused the result. `invalid_param` — a supplied value does
   * not match what the capability declares.
   */
  reason?: 'not_an_integration_source' | 'source_rejected' | 'invalid_param';
  /** Human-facing failure detail, present only on `failed`. */
  message?: string;
  /** Authored param names actually written on this version. */
  appliedParams: string[];
}

/**
 * Partial failure is reported, never thrown: one action's param failing
 * validation must not stop the installer connecting the other nine, and must
 * not leave the slot bound silently.
 */
export interface ManagedAppRebindProviderResType {
  /** True when nothing on the slot failed. */
  success: boolean;
  /** Echoes the slot key the call selected on. */
  groupKey: string;
  integrationId: string;
  /**
   * The resolved connection, in the shape
   * `ManagedAppSetupProviderGroup.boundIntegration` carries — so a caller can
   * patch the slot's row without refetching the status.
   */
  boundIntegration: ManagedAppSetupBoundIntegration;
  bound: number;
  unchanged: number;
  failed: number;
  results: ManagedAppRebindProviderResultEntry[];
}

export interface MarketplacePublisherType {
  id?: string;
  /** Decides who may edit the publisher, not where it lives. A handle is free
   *  and needs no organisation; a workspace claims one. */
  fk_workspace_id?: string;
  /** Immutable slug. The facet and filter key — never `name`, which is a
   *  mutable display string a rename would break every shared filter URL on. */
  handle?: string;
  name?: string;
  bio?: string;
  website?: string;
  logo?: string;
  accent?: string;
  verified?: boolean;
  delisted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export enum MarketplaceCurationSlot {
  HERO = 'hero',
  FEATURED = 'featured',
}

export enum MarketplaceReportReason {
  SPAM = 'spam',
  MALWARE = 'malware',
  IMPERSONATION = 'impersonation',
  IP = 'ip',
  OTHER = 'other',
}

export interface ListingCapabilityManifest {
  /** Bumped when a disclosure field is added, so a listing whose manifest
   *  predates a field renders "published before this was disclosed" rather
   *  than an absent section. Without it, an older less-disclosing release
   *  looks cleaner than a current one. */
  manifestVersion: number;
  contents: {
    tables: number;
    views: number;
    automations: number;
    dashboards: number;
    apps: number;
    actions: number;
    interfaces: number;
    pages: number;
  };
  aiFields: { table: string; field: string; reads: string[] }[];
  workflows: { name: string; trigger: string }[];
  actions: { id: string; name: string; summary: string }[];
  teams: { title: string }[];
  integrations: {
    subType: string;
    title: string;
    purpose: string | null;
    required: boolean;
  }[];
  reach: {
    ownBase: true;
    /** No externalCalls: workflow node types are an open, unenumerable catalogue — the frontend renders a static warning line instead. */
    aiModels: boolean;
  };
  /** Keys whose values are publisher- or AI-authored free text, not derived
   *  facts. The frontend must attribute these visibly. */
  authored: string[];
}

export const MARKETPLACE_MANIFEST_VERSION = 1;

/** Every shelf and search row. `description`, the base snapshot and the rebind
 *  manifest never leave the server on a browse path. */
/**
 * The publisher as the storefront returns it. `logo` is signed for rendering,
 * where MarketplacePublisherType carries the stored ref the model persists.
 */
export type MarketplacePublisherDetailType = Omit<
  MarketplacePublisherType,
  'logo'
> & {
  logo: AttachmentResType | null;
};

export interface MarketplaceCardType {
  id: string;
  /** The listing's readable address. Null until it is listed; the id resolves
   *  at the same position, so a link never depends on this being set. */
  slug: string | null;
  title: string;
  tagline: string;
  categories: ManagedAppCategory[];
  cover: AttachmentResType | null;
  publisher: {
    handle: string;
    name: string;
    verified: boolean;
    logo: AttachmentResType | null;
    accent: string | null;
  };
  install_count: number;
  last_release_at: string | null;
  latest_version: string | null;
  has_agents: boolean;
  counts: {
    tables: number;
    actions: number;
    automations: number;
    aiFields: number;
  };
}

export interface MarketplaceFacetsType {
  categories: { key: ManagedAppCategory; count: number }[];
  publishers: {
    handle: string;
    name: string;
    verified: boolean;
    count: number;
  }[];
}

/**
 * Where a listing already lives for this caller. The install is the BASE — a
 * listing published from a base that ships no App row installs no app, and the
 * store still has to say "installed" and still has to be able to open it.
 */
export interface MarketplaceInstallRefType {
  listingId: string;
  baseId: string;
  workspaceId: string;
  /** null for a base-only listing: open the base, not a live app session. */
  appId: string | null;
}

export interface MarketplaceHomeResType {
  hero: MarketplaceCardType[];
  featured: MarketplaceCardType[];
  charts: MarketplaceCardType[];
  newThisMonth: MarketplaceCardType[];
  recent: MarketplaceCardType[];
  agentic: MarketplaceCardType[];
  workspace: MarketplaceCardType[];
  organisation: MarketplaceCardType[];
  facets: MarketplaceFacetsType;
  installs: MarketplaceInstallRefType[];
}

export interface MarketplaceSearchResType {
  list: MarketplaceCardType[];
  facets: MarketplaceFacetsType;
  pageInfo: { totalRows: number; page: number; pageSize: number };
  installs: MarketplaceInstallRefType[];
}

/**
 * A publisher's own page. The apps themselves come from `marketplaceSearch`
 * filtered on the handle, so one query path serves the storefront and this —
 * the totals here are over everything the caller may list, which is why they
 * can exceed a single page.
 */
export interface MarketplacePublisherProfileResType {
  publisher: MarketplacePublisherDetailType;
  appCount: number;
  installCount: number;
  /** When this publisher first shipped anything; null before the first publish. */
  firstPublishedAt: string | null;
  /** The viewer's own membership role, or null when they are not a member.
   *  One page serves owner and visitor; this is what adds the affordances. */
  viewerRole: MarketplacePublisherRole | null;
  /** Whether the viewer may write this profile — `owner` or `admin`. */
  canEdit: boolean;
}

export enum MarketplacePublisherRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

/**
 * One row of a publisher's own shelf: the card the store would draw, plus the
 * state that decides which chip it wears. `listed` is `published_at` — the flag
 * an unpublish nulls — so a withdrawn listing reads as withdrawn instead of
 * vanishing the way the storefront's filter makes it vanish.
 */
export interface MarketplacePublisherAppType extends MarketplaceCardType {
  listed: boolean;
  visibility: ManagedAppVisibility;
  suspended_at: string | null;
  suspended_reason: string | null;
}

export interface MarketplacePublisherAppsResType {
  apps: MarketplacePublisherAppType[];
}

export interface MarketplaceListingResType {
  listing: MarketplaceCardType & {
    description: string | null;
    visibility: ManagedAppVisibility;
    /** Part of the disclosure, not a detail: it decides what the buyer gets. */
    install_surface: ManagedAppInstallSurface;
    first_published_at: string | null;
    screenshots: AttachmentResType[];
  };
  publisher: MarketplacePublisherDetailType;
  capabilities: ListingCapabilityManifest | null;
  rebind: RebindManifest | null;
  versions: {
    id: string;
    version: string;
    version_number: number;
    release_notes: string | null;
    published_at: string;
  }[];
  whatsNew: string | null;
  /** The version whose disclosure the buyer actually read. Install refuses a
   *  stale value rather than silently installing a newer release. */
  reviewedVersionId: string;
  installed: MarketplaceInstallRefType | null;
}
