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
 * Two window globals are injected by the app shell at serve time (the preview
 * controller writes them into the served HTML):
 *   window.__nc_app_invoke_url__  absolute path the app POSTs routine invocations to
 *   window.__nc_app_user__        { id, email?, displayName?, role? }
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

  const res = await fetch(invokeUrl, {
    method: 'POST',
    credentials: 'omit', // opaque-origin: auth is the JWT-in-path, never cookies
    headers: { 'content-type': 'application/json' },
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

// Route-sync: emit the current hash whenever the app navigates internally
// (HashRouter fires hashchange on every navigation). The full-bleed parent
// listens and updates its own outer URL hash without reload so deep-links stay
// shareable. Child→parent only; postMessage to '*' is safe under an opaque
// (sandbox=allow-scripts, no allow-same-origin) origin — no allow-same-origin
// needed.
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    window.parent.postMessage(
      { type: 'nc-app-route', path: window.location.hash },
      '*',
    );
  });
}
