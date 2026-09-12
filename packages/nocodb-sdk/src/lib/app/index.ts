export enum AppStatus {
  DRAFT = 'draft',
  BUILDING = 'building',
  READY = 'ready',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export interface AppVersionType {
  id?: string;
  fk_app_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  version_number?: number;
  status?: AppStatus;
  git_sha?: string;
  created_by?: string;
  created_at?: string;
}

export interface AppType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  title?: string;
  description?: string;
  meta?: Record<string, any>;
  order?: number;
  fk_draft_version_id?: string;
  fk_live_version_id?: string;
  last_build_error?: string;
  created_by?: string;
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  slug?: string;
  /**
   * Publisher-owned custom domain (e.g. `app.acme.com`) the live app is also
   * served on. Globally unique across the deployment; set via the validated
   * `setAppCustomDomain` flow only (never raw client updates). Null/absent →
   * the app serves only on `<slug>.<apps-domain>`.
   */
  custom_domain?: string | null;
  /**
   * The nonce the claimant publishes in DNS to prove ownership. Not a
   * credential — it is only meaningful once it is public in a TXT record on the
   * domain being claimed, and it grants nothing on its own.
   */
  custom_domain_token?: string | null;
  /**
   * When ownership of `custom_domain` was proved. Until this is set the domain
   * is a claim, not a route: nothing resolves or is served on it.
   */
  custom_domain_verified_at?: string | null;
  /**
   * Derived (non-persisted): the DNS record the claimant has to publish before
   * the domain will serve. Attached by the claim and verify flows so the record
   * format stays a server-side contract rather than something the client
   * reconstructs. Absent once verified, or when no domain is claimed.
   */
  custom_domain_challenge?: AppCustomDomainChallenge;
  /** Derived (non-persisted): true when the draft has been built past the live version's sha. */
  hasUnpublishedChanges?: boolean;
  /**
   * Derived (non-persisted): the public origin where the live app is served
   * (`https://<slug>.<apps-domain>/`). Present only when the app has a live
   * version and a resolvable apps domain — otherwise undefined. This is the
   * clean, shareable link members open; the console resolves the per-visit
   * handshake (OTT) separately.
   */
  public_url?: string;
  /**
   * Derived (non-persisted), installed apps only: the title of the sealed base
   * the app was installed into — the Solution's name. The app row inside a
   * package carries the publisher's own inner title (often just "App"), which
   * is not what the installer recognises.
   */
  installed_base_title?: string;
  /**
   * Derived (non-persisted), installed apps only: the store listing this app
   * was installed from, so the store can mark what a workspace already has.
   */
  installed_managed_app_id?: string;
}

/** The DNS record proving ownership of a claimed custom domain. */
export interface AppCustomDomainChallenge {
  type: 'TXT';
  name: string;
  value: string;
}

/**
 * Result of checking a custom domain's DNS challenge.
 *
 * `verified: false` is the expected answer while DNS propagates, not an error —
 * the caller is meant to poll. `challenge` is echoed back so the record stays on
 * screen while waiting, and is null once there is nothing left to publish.
 */
export interface AppCustomDomainVerifyResult {
  verified: boolean;
  domain?: string | null;
  challenge: AppCustomDomainChallenge | null;
  public_url?: string;
}

export * from './agent';
export * from './build';
export * from './routine';
export * from './theme';
export * from './publish';
export * from './team';

/**
 * One normalised route declaration the build's route manifest produces — a
 * route in `src/routes.ts` marked `handle.public`, resolved to the path the
 * platform can serve to anonymous visitors.
 *
 * Intermediate shape only. The serving authority is the per-version snapshot in
 * `nc_app_version_public_routes`, written at publish from these.
 */
export interface AppPublicRouteDecl {
  /** Exact app path (`/pricing`) or a single trailing prefix glob (`/docs/*`). */
  path: string;
  /** `<title>` and `og:title` for anonymous serves. Falls back to the app title. */
  title?: string;
  /** `<meta name="description">` and `og:description`. */
  description?: string;
  /** Bundle-relative asset path (`assets/og.png`) — never an absolute URL. */
  og_image?: string;
  /** Exact `https://` origins allowed to iframe ANONYMOUS serves of this route. */
  embed_origins?: string[];
}
