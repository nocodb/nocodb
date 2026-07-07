/**
 * @nocodb/app-ctx — typed runtime module for NocoDB app routines.
 *
 * Compiled at image-build into the shared starter node_modules
 * (`/opt/starter-template/node_modules/@nocodb/app-ctx`) — the dir every built
 * app symlinks each turn — so apps `import { ctx } from '@nocodb/app-ctx'` and
 * resolve it like any dependency, with no per-app alias, tsconfig path, or
 * source file. This is nocovibe's `@nocovibe/ctx` pattern. A change here ships
 * with the next E2B image rebuild and reaches every app (new + hydrated).
 *
 * Window globals injected by the app shell at serve time (the preview controller
 * and the published serve middleware write them into the served HTML):
 *   window.__nc_app_invoke_url__  path the app POSTs routine invocations to
 *   window.__nc_app_user__        { id, email?, displayName?, role? }
 *   window.__nc_app_live__        true on the published origin — invoke then
 *                                 authenticates with the same-origin session
 *                                 cookie + CSRF header (preview uses a token in
 *                                 the invoke path and sends no cookies)
 *
 * Import and use:
 *   import { ctx } from '@nocodb/app-ctx'
 *   const rows = await ctx.routines.myRoutine({ filter: 'active' })
 *   const me = ctx.user  // AppUser | undefined
 *
 * This module is the single source of the app routine runtime. Its
 * browser↔broker contract is guarded by the backend unit test
 * tests/unit/rest/tests/internal/ee/app-ctx-module.test.ts.
 */

export interface AppUser {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
}

export type IntegrationErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'invalid_input'
  | 'rate_limited'
  | 'timeout'
  | 'remote_error'
  | 'broker_error';

export class IntegrationError extends Error {
  code: IntegrationErrorCode;
  detail?: unknown;

  constructor(code: IntegrationErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    this.detail = detail;
  }
}

declare global {
  interface Window {
    __nc_app_invoke_url__?: string;
    __nc_app_user__?: AppUser;
    __nc_app_live__?: boolean;
  }
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

async function invoke(name: string, params: unknown): Promise<unknown> {
  const invokeUrl = window.__nc_app_invoke_url__;
  if (!invokeUrl) {
    throw new IntegrationError(
      'broker_error',
      'Routine invoke URL not available',
    );
  }

  // Published origin (`__nc_app_live__`): authenticate with the same-origin
  // `__Host-nc_app` session cookie + CSRF header, so credentials must be sent.
  // Preview: token-in-path on an opaque origin — must NOT send cookies.
  const live = window.__nc_app_live__ === true;

  const res = await fetch(invokeUrl, {
    method: 'POST',
    credentials: live ? 'include' : 'omit',
    headers: live
      ? { 'content-type': 'application/json', 'x-nc-app-request': '1' }
      : { 'content-type': 'application/json' },
    body: JSON.stringify({ name, params }),
  });

  let body: {
    code?: IntegrationErrorCode;
    message?: string;
    detail?: unknown;
  } | null = null;
  try {
    body = (await res.json()) as {
      code?: IntegrationErrorCode;
      message?: string;
      detail?: unknown;
    };
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
    const e = body ?? {};
    throw new IntegrationError(
      e.code ?? 'broker_error',
      e.message ?? `invoke failed with status ${res.status}`,
      e.detail,
    );
  }

  return body;
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
  storage: makeStorage(),
  routines: new Proxy(
    {} as Record<string, (params?: unknown) => Promise<unknown>>,
    {
      get(
        _t: Record<string, (params?: unknown) => Promise<unknown>>,
        name: string | symbol,
      ) {
        return (params?: unknown) => invoke(String(name), params);
      },
    },
  ),
};
