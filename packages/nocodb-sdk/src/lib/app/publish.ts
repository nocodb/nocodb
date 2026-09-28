/**
 * A team grant matching none of the actions this version pins. Authoring-time
 * coverage notes cannot be definitive — teams and actions are authored in any
 * order — but at publish the pinned set is final, so this one is dead.
 */
export interface DeadGrantWarning {
  kind: 'dead_grant';
  teamHandle: string;
  capability: string;
}

/**
 * A `handle.public` the platform could not turn into a servable declaration.
 * The app still builds and runs; only that one page is not published.
 */
export interface UnpublishableRouteWarning {
  kind: 'unpublishable_route';
  /** As written (`/docs/:slug`), or `src/routes.ts` if the whole registry was
   *  refused. */
  route: string;
  reason: string;
}

/**
 * A table this version's actions touch whose rows some app team reads
 * unfiltered. A warning, never a refusal: an app whose rows genuinely are not
 * per-person is a normal app, and only the owner knows which kind this is.
 *
 * Two lists, because enforcement is per (table, team): a team matching no
 * policy on a table with no default reads every row, so one rule scopes one
 * team and leaves the rest as open as before.
 */
export interface UnscopedTableWarning {
  kind: 'unscoped_table';
  /** Table titles no enabled rule covers at all. */
  tables: string[];
  /** Tables a rule covers for SOME teams, with the ones it does not. */
  partiallyScoped: Array<{ table: string; openTeams: string[] }>;
}

export type PublishWarning =
  | DeadGrantWarning
  | UnpublishableRouteWarning
  | UnscopedTableWarning;

/** One route a deploy changes about the app's ANONYMOUS surface. */
export interface PublicRouteSummary {
  /** `/`, `/pricing`, or a trailing glob `/docs/*`. */
  path: string;
  title?: string;
  /** Exact https origins this deploy authorises to iframe the anonymous serve. */
  embed_origins?: string[];
}

/**
 * One action a deploy makes callable by an anonymous visitor, in the terms the
 * human approving it needs: what it does, to what, and which part of it the
 * visitor chooses. The platform does not limit which integrations a public
 * action may reach, so `callerControlled` has to say what the caller decides.
 */
export interface PublicActionSummary {
  actionId: string;
  /** What a visitor can do, in one word. */
  effect: 'read' | 'write' | 'call';
  /** Table title, for a platform-data action. */
  table?: string;
  /** The pinned allow-list on a read, the bound columns on a write — this IS
   *  the column scope. */
  fields?: string[];
  /** Op fields the VISITOR supplies. Empty when the author pinned everything. */
  callerControlled?: string[];
  /** `fields` is empty for one, since a delete names no columns, and
   *  "writes to X ()" hid what it was. */
  removes?: boolean;
  /** No row filter and no guard: every row, to anyone who calls it. The seal
   *  never constrains a read's row scope, so the disclosure must. */
  allRows?: boolean;
  /** `table` then names the far side on a read, and the table whose links
   *  change on a write. */
  relation?: string;
  /** The connection an integration action reaches, by title. */
  connection?: string;
  /** The egress surface an anonymous write turns on. */
  activeHooks?: number;
}

/**
 * What a version changes about what an anonymous visitor can read, against the
 * one it replaces. `added` cannot be taken back once a crawler has seen it, so
 * it is stated first and stated before the deploy.
 */
export interface PublicSurfaceDelta {
  added: PublicRouteSummary[];
  removed: string[];
  /** Same path, changed meta — only `embed_origins` movement is reported. */
  embedOriginsAdded: { path: string; origins: string[] }[];
  embedOriginsRemoved: { path: string; origins: string[] }[];
  /** True when a declaration publishes the entire origin (`/*`). */
  publishesWholeOrigin: boolean;
  /** True when the live version had no public routes and this one does. */
  firstPublicRelease: boolean;
  /**
   * A CHANGED pinned version counts as newly exposed: widening a public action's
   * column allow-list is new anonymous data, and moves nothing else here.
   */
  actionsAdded: PublicActionSummary[];
  /** Action ids the live version exposed anonymously and this one does not. */
  actionsRemoved: string[];
}

/**
 * What the owner agreed anonymous visitors may reach. Keyed on the capability
 * SET rather than a boolean: a packaged app's `public` grants arrive through
 * `applyMeta` with nobody having agreed to them, and an upgrade that widens
 * the set is not covered by consent given to the narrower one.
 */
export interface AppPublicConsent {
  capabilities: string[];
  /**
   * A hash over the pinned version's kind, capability and impl. The capability
   * set alone misses the other way a surface widens — keeping every grant but
   * widening the columns under one. An unrecorded fingerprint admits nobody.
   */
  actions: Record<string, string>;
  consented_at: string;
  consented_by?: string;
}

/**
 * The anonymous surface of an app's LIVE version, and whether anyone has agreed
 * to it. For a self-published app the publish confirmation IS the consent; this
 * is what an INSTALLED app's console shows and acts on.
 */
export interface PublicSurfaceConsentState {
  /** Frozen into the live version; empty means nothing to consent to. */
  capabilities: string[];
  /** True when every granted capability is covered by the recorded consent. */
  consented: boolean;
  /** What those grants let an anonymous visitor do, in the reach delta's terms. */
  actions: PublicActionSummary[];
  /**
   * The per-action fingerprints in aggregate, echoed back on consent so an
   * upgrade landing mid-decision is refused as `surfaceMoved` even when the
   * capability set is unchanged.
   */
  surfaceFingerprint: string;
  consentedAt?: string;
  consentedBy?: string;
}

export interface PublishOk {
  ok: true;
  versionNumber: number;
  versionId: string;
  /** The draft sha already equals the live version's — a no-op republish. */
  alreadyLive?: boolean;
  pinnedActions: string[];
  warnings: PublishWarning[];
  publicSurfaceDelta: PublicSurfaceDelta;
}

/**
 * What a human is shown BEFORE confirming a deploy, pinned to the sha it was
 * computed from. No writes and no lock, so it is safe to call on dialog open.
 */
export interface PublicSurfacePreview {
  /** The draft sha the delta was computed from; null when there is no build yet. */
  sha: string | null;
  delta: PublicSurfaceDelta;
  /** Declarations the platform could not turn into a servable route. */
  rejected: { route: string; reason: string }[];
  /** Set when the whole registry was refused: the surface is UNKNOWN, not empty. */
  refused?: string;
  /**
   * Distinct from `refused`: publish reads this as "no public routes", and the
   * preflight must say so rather than imply the surface could not be read.
   */
  manifestMissing?: boolean;
  /** Routes in the registry, and how many of them are public. */
  routeCount: number;
  publicCount: number;
}

/** One page the live version serves to anonymous visitors. */
export interface PublicSurfacePage {
  /** The declared path, `:param` segments and all. */
  path: string;
  title?: string;
  description?: string;
  og_image?: string;
  embed_origins?: string[];
  /** A `:param` or trailing glob names a SHAPE, not an address, so it has none. */
  url?: string;
}

/**
 * What the internet reaches today, what publishing the draft would change, and
 * every declaration the platform refused to serve. Otherwise the pages and the
 * invocable actions live in two unrelated places, and a refusal in neither.
 */
export interface AppPublicSurface {
  /** The app's public origin; absent until it has a slug or a custom domain. */
  origin?: string;
  /** Pages the LIVE version serves, in match order. */
  pages: PublicSurfacePage[];
  /** As authored: it takes effect on the next publish, since the live version
   *  runs on its own frozen copy. */
  capabilities: string[];
  /** What publishing the current draft would change about those pages. */
  pending: { added: string[]; removed: string[] };
  /** Declarations in the draft that cannot be served, each with its reason. */
  rejected: { route: string; reason: string }[];
  /** The whole registry was refused — the surface is UNKNOWN, not empty. */
  refused?: string;
  /** The build produced no route manifest at all. */
  manifestMissing?: boolean;
  /** Per minute. Absent where no shared counter enforces them. */
  rateLimits?: { perVisitor: number; perApp: number };
}

export interface PublishFail {
  ok: false;
  missingActions?: string[];
  ungrantedActions?: {
    actionId: string;
    integrationId: string;
    integrationTitle: string;
  }[];
  /**
   * Actions the public document and MCP tool list could not carry. Nothing was
   * published: one that ships and is then dropped by the renderers is an action
   * the author was told went live and no client can see.
   */
  invalidActions?: {
    actionId: string;
    code: string;
    /** Written for the app's author: what is wrong, and what to change. */
    message: string;
  }[];
  /**
   * Nothing was published: a public grant is the one grant whose reach is
   * unauthenticated, so an unsealed one is a refusal rather than a warning.
   */
  unsealedPublicActions?: {
    actionId: string;
    /** The spec rule id — A1..A6, C, X1..X3. */
    rule: string;
    field?: string;
    /** Written for the app's author: what is wrong, and what to change. */
    message: string;
  }[];
  buildIncomplete?: boolean;
  /**
   * The draft advanced between the preflight the human approved and this call,
   * and the recomputed public surface is not the one they saw. Nothing was
   * published; `preview` carries the fresh surface to confirm instead.
   */
  publicSurfaceMoved?: boolean;
  /**
   * This deploy would widen the anonymous surface and no preflight was approved
   * — the caller published without ever showing a human what goes public.
   * Nothing was published; confirm against `preview` and publish again with its
   * `sha`. A deploy that widens nothing never sees this.
   */
  publicSurfaceUnconfirmed?: boolean;
  preview?: PublicSurfacePreview;
}

export type PublishResult = PublishOk | PublishFail;

export interface AppVersionSummary {
  versionId: string;
  versionNumber: number;
  gitShaShort: string;
  createdBy: string;
  createdAt: string;
  isLive: boolean;
}

export interface AppLiveSession {
  url: string;
}

/**
 * The three facts a single Publish press reads. Nobody picks a mode; the state
 * answers, and the dialog dresses itself from these.
 */
export interface PublishFacts {
  /** The press came from an environment lane, so it converges first. */
  inLane: boolean;
  /** The production base's store listing — null when it was never listed. */
  managedAppId: string | null;
  /** That listing has a live store page, so the press fans out to installs. */
  listed: boolean;
  /** The base the publish actually writes to. */
  productionBaseId: string;
}

/** What the converge actually did, so a receipt never has to guess. */
export interface ConvergeReceipt {
  applied: number;
  skipped: number;
  failed: number;
  /** No pending entries — Production already held what the lane holds. */
  nothingToApply: boolean;
  /**
   * The converge stopped part-way, and the counts above are what Production is
   * left holding. Absent on a converge that ran to the end — nothing else
   * separates the two, and a half-applied converge reporting "nothing changed"
   * is the lie this field exists to stop.
   */
  error?: string;
  /** The changelog entry it stopped on. */
  failedEntryId?: string;
  /** That entry's event, so a receipt can name what it stopped on. */
  failedEvent?: string;
  /** Entries it never reached — still pending, so pressing again resumes there. */
  remaining?: number;
}

/** One store release, as `basePublish` reports it. */
export interface StoreReleaseResult {
  message: string;
  managedAppId: string;
  versionId: string;
  version: string;
  isInitialPublish: boolean;
  /** The install fan-out job, absent when the app is delisted. */
  updateJobId: string | null;
  /** Installed copies that job moves to this version; 0 when it did not run. */
  installs: number;
}

/** The listing a press created, when the press was asked to create one. */
export interface StoreListingResult {
  managedAppId: string;
  /** False when the base already had a listing and this press only released it. */
  created: boolean;
  /** Where the work moves to: listing locks Production behind a lane. */
  laneBaseId: string;
}

/**
 * The Staging lane a press opened or adopted. Publishing puts the app in front
 * of users, so Production stops being the place to edit it — every later press
 * converges from here.
 */
export interface StoreLaneResult {
  /** Null only when the lane could not be opened; `error` says why. */
  laneBaseId: string | null;
  /**
   * True when THIS press opened it — the publisher is standing on a Production
   * that now refuses their next schema edit, and has to be moved.
   */
  opened: boolean;
  /** Reported rather than thrown: the live link had already moved. */
  error?: string;
}

/**
 * One Publish press. Each field is null when its fact was false — `converge`
 * off-lane, `release` on a base that was never listed, `serve` on a base with
 * no app at all.
 */
export interface BasePublishResult {
  converge: ConvergeReceipt | null;
  serve: PublishResult | null;
  release: StoreReleaseResult | null;
  /** Set only by a press that carried `list`; null on every ordinary publish. */
  listing: StoreListingResult | null;
  /**
   * Where the work moves to. Null when the press served nothing — a base with
   * no app has nothing live to protect.
   */
  lane: StoreLaneResult | null;
  /** The facts as READ, before the press changed any of them. */
  facts: PublishFacts;
}

/** One dropped table or field in a pending converge, and what it costs. */
export interface PublishDrop {
  /** `tableDelete` or `columnDelete`. */
  event: string;
  /** The table or field being dropped. */
  entityTitle: string;
  /** The table a dropped field belongs to; empty for a dropped table. */
  parentTitle: string;
  /** Rows in Production's copy of the table this lands on. */
  rows: number;
}

/**
 * What the Publish button and dialog read before anything is pressed. The
 * client cannot derive it: standing in a lane, the base carries no
 * `managed_app_id` of its own.
 */
export interface BasePublishState {
  facts: PublishFacts;
  app: {
    id: string;
    slug?: string;
    publicUrl: string | null;
    hasUnpublishedChanges: boolean;
    /** What a visitor is served right now; null before the first publish. */
    liveVersionNumber: number | null;
  } | null;
  /** Lane changes this press would carry to Production; 0 off-lane. */
  pendingChanges: number;
  /**
   * The pending changes that cost rows rather than structure — a dropped table
   * or field. Empty on a press that drops nothing.
   */
  drops: PublishDrop[];
  /**
   * Installed copies this press moves to the new version. 0 unless the app is
   * listed right now; a drop costs each of them their rows.
   */
  installs: number;
  /**
   * When the lane's records were last re-taken from Production. Null off-lane,
   * and null on a lane that has never been synced since it was opened.
   */
  laneDataSyncedAt: string | null;
  /** The listing's newest released version, so the dialog can suggest a bump. */
  latestVersion: string | null;
}
