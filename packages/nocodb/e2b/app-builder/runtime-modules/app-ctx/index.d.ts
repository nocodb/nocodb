// Public type surface for the @nocodb/app-ctx runtime package. The
// implementation is compiled from index.ts at image-build into index.js; this
// declaration is what app code type-checks against. Keep it in lockstep with
// the exports in index.ts.
//
// `ActionId`, `Capability` and `ActionTeam` are copied from server.d.ts §1–§2
// (itself verbatim from `contract-app-actions.ts`) rather than imported —
// server.d.ts pulls in `zod/v4` types, which the browser surface must not
// require an app to resolve. The shapes must not drift.

export interface AppUser {
  id: string;
  email?: string;
  displayName?: string;
}

/** Dotted, lowercase: `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`. */
export type ActionId = string;

/** An exact action id or a glob over one namespace — `billing.*`. */
export type Capability = string;

/** Bound by `handle`, never by id — one published app runs across many installs. */
export interface ActionTeam {
  handle: string;
  title: string;
}

export type IntegrationErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'invalid_input'
  | 'rate_limited'
  | 'timeout'
  | 'remote_error'
  | 'broker_error';

/**
 * The wire error code is open (`{ error: { code: string } }` — e.g. `forbidden`,
 * `unknown_action`) and is passed through verbatim; the union above is only what
 * this module raises on its own.
 */
export type ActionErrorCode = IntegrationErrorCode | (string & {});

export class IntegrationError extends Error {
  code: ActionErrorCode;
  detail?: unknown;
  constructor(code: ActionErrorCode, message: string, detail?: unknown);
}

export interface AppStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const ctx: {
  readonly user: AppUser | undefined;
  /** The caller's memberships, bound by `handle`. Empty when none was injected. */
  readonly teams: readonly ActionTeam[];
  /**
   * RENDERING AID ONLY — mirrors what the server will decide, so generated UI
   * can hide what the caller cannot do. Never the enforcement point: dispatch
   * checks the same capability before the action runs and returns 403 regardless
   * of what this returned.
   */
  can(capability: Capability): boolean;
  storage: AppStorage;
  /** `POST /api/v1/:appId/:actionId` — keyed by dotted action id. */
  readonly actions: Record<ActionId, (input?: unknown) => Promise<unknown>>;
};
