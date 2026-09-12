/**
 * @nocodb/app-ctx — the app action runtime, imported by built apps as a plain
 * dependency. Compiled at image-build into the shared starter node_modules
 * (`/opt/starter-template/node_modules/@nocodb/app-ctx`), which every built app
 * symlinks each turn, so a change here ships with the next E2B image rebuild and
 * reaches every app. The browser<->broker contract is guarded by
 * tests/unit/rest/tests/internal/ee/app-ctx-module.test.ts.
 */

export interface AppUser {
  id: string;
  email?: string;
  displayName?: string;
}

/**
 * Action identity and team shape are copied from `server.d.ts` §1–§2 (itself
 * verbatim from `contract-app-actions.ts`). They are re-declared rather than
 * imported: `server.d.ts` pulls in `zod/v4` types, which the browser module must
 * not require an app to resolve. Keep the shapes in lockstep.
 */
export type ActionId = string; // ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$

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
 * The wire error code is OPEN (`{ error: { code: string } }` — contract §4, e.g.
 * `forbidden`, `unknown_action`) and is passed through verbatim. The union above
 * is only what this module raises on its own; widening keeps the type honest
 * rather than narrowing it to a claim the server does not make.
 */
export type ActionErrorCode = IntegrationErrorCode | (string & {});

export class IntegrationError extends Error {
  code: ActionErrorCode;
  detail?: unknown;

  constructor(code: ActionErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    this.detail = detail;
  }
}

declare global {
  interface Window {
    __nc_app_action_url__?: string;
    __nc_app_user__?: AppUser;
    __nc_app_teams__?: ActionTeam[];
    __nc_app_capabilities__?: Capability[];
    __nc_app_live__?: boolean;
  }
}

/** Response envelope of `POST /api/v1/:appId/:actionId` — contract §4. */
interface ActionResponseBody {
  data?: unknown;
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * Re-handshake loop guard: allow at most one reload per short window, so a 401
 * that a reload cannot fix (e.g. the console session is also gone) doesn't spin.
 */
function shouldRehandshake(): boolean {
  try {
    const KEY = '__nc_app_reauth_at__';
    const now = Date.now();
    const last = Number(window.sessionStorage.getItem(KEY) || '0');
    if (now - last < 10_000) return false;
    window.sessionStorage.setItem(KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

/**
 * Does `grant` cover `capability`? Mirrors `matchesCapability` in
 * `packages/nocodb/src/ee/helpers/actionId.ts` — THAT function is the source of
 * truth (the server re-checks at dispatch); this module cannot import from
 * `src/`, so the semantics are reimplemented here and must not drift.
 *
 * A grant is either an exact action id or a trailing glob over one namespace
 * (`billing.*`); the dot stays in the prefix, so a glob never crosses a
 * namespace boundary (`billing.*` does not match `billingx.run`). Total by
 * design — never throws, so a malformed grant degrades to "no access".
 */
function matchesCapability(capability: string, grant: string): boolean {
  if (typeof capability !== 'string' || typeof grant !== 'string') return false;
  if (grant === capability) return true;

  if (grant.endsWith('.*')) {
    // keep the dot in the prefix: 'billing.' never matches 'billingx.run'
    const prefix = grant.slice(0, -1);
    return capability.startsWith(prefix);
  }

  return false;
}

function reportActionError(actionId: string, err: IntegrationError): void {
  try {
    document.dispatchEvent(
      // Event name and `actionName` detail key are the preview bridge's
      // contract (`appThemeInjection.ts`) — the value is the action id.
      new CustomEvent('nc:action-error', {
        detail: { actionName: actionId, message: err.message, code: err.code },
      }),
    );
  } catch {
    /* reporting must never mask the real failure */
  }
}

/**
 * The action id is always the final path segment; the base is opaque to the app
 * (live: `/api/v1/:appId/`, preview: the token path the preview controller
 * proxies). Encoded so a malformed key can never rewrite the path.
 */
function actionEndpoint(base: string, actionId: string): string {
  const sep = base.endsWith('/') ? '' : '/';
  return base + sep + encodeURIComponent(actionId);
}

async function invoke(actionId: string, input: unknown): Promise<unknown> {
  const actionUrl = window.__nc_app_action_url__;
  if (!actionUrl) {
    const err = new IntegrationError(
      'broker_error',
      'Action invoke URL not available',
    );
    reportActionError(actionId, err);
    throw err;
  }

  // Published origin (`__nc_app_live__`): authenticate with the same-origin
  // `__Host-nc_app` session cookie + CSRF header, so credentials must be sent.
  // Preview: token-in-path on an opaque origin — must NOT send cookies.
  const live = window.__nc_app_live__ === true;

  const res = await fetch(actionEndpoint(actionUrl, actionId), {
    method: 'POST',
    credentials: live ? 'include' : 'omit',
    headers: live
      ? { 'content-type': 'application/json', 'x-nc-app-request': '1' }
      : { 'content-type': 'application/json' },
    body: JSON.stringify({ input }),
  });

  let body: ActionResponseBody | null = null;
  try {
    body = (await res.json()) as ActionResponseBody;
  } catch (_parseErr) {
    body = null;
  }

  if (!res.ok) {
    // Published session expired mid-use (401) → re-handshake: a top-level reload
    // hits the serve gate, which bounces through the console to mint a fresh 1h
    // cookie and returns to this route. A cooldown prevents a reload loop when
    // re-auth can't succeed (a revoked runner is already denied at the doc).
    if (live && res.status === 401 && shouldRehandshake()) {
      window.location.reload();
    }
    const e = body?.error ?? {};
    const err = new IntegrationError(
      e.code ?? 'broker_error',
      e.message ?? `invoke failed with status ${res.status}`,
      e.details,
    );
    reportActionError(actionId, err);
    throw err;
  }

  // 2xx is always `{ data }` — the app gets the payload, not the envelope.
  return body?.data;
}

function makeStorage() {
  const mem = new Map<string, string>();
  const ls = (): Storage | null => {
    try {
      // Throws SecurityError under an opaque (sandbox=allow-scripts) origin.
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  };
  return {
    get(key: string): string | null {
      const s = ls();
      try {
        if (s) return s.getItem(key);
      } catch {
        /* fall through to memory */
      }
      return mem.has(key) ? mem.get(key)! : null;
    },
    set(key: string, value: string): void {
      const s = ls();
      try {
        if (s) {
          s.setItem(key, value);
          return;
        }
      } catch {
        /* fall through to memory */
      }
      mem.set(key, value);
    },
    remove(key: string): void {
      const s = ls();
      try {
        if (s) s.removeItem(key);
      } catch {
        /* ignore */
      }
      mem.delete(key);
    },
  };
}

export const ctx = {
  get user(): AppUser | undefined {
    return window.__nc_app_user__;
  },
  /** The caller's memberships, bound by `handle`. Empty when none was injected. */
  get teams(): readonly ActionTeam[] {
    const teams = window.__nc_app_teams__;
    return Array.isArray(teams) ? teams : [];
  },
  /**
   * RENDERING AID ONLY — a pure local match against the injected grant list, so
   * generated UI can hide what the caller cannot do. It is NEVER the enforcement
   * point: dispatch checks the same capability server-side before the action
   * runs and returns 403 regardless of what this returned. Fail-closed when
   * nothing was injected.
   */
  can(capability: Capability): boolean {
    const grants = window.__nc_app_capabilities__;
    if (!Array.isArray(grants)) return false;
    return grants.some((grant) => matchesCapability(capability, grant));
  },
  storage: makeStorage(),
  actions: new Proxy(
    {} as Record<ActionId, (input?: unknown) => Promise<unknown>>,
    {
      get(
        _t: Record<ActionId, (input?: unknown) => Promise<unknown>>,
        actionId: string | symbol,
      ) {
        return (input?: unknown) => invoke(String(actionId), input);
      },
    },
  ),
};
