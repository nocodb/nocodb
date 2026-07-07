/**
 * @nocodb/app-ctx — typed runtime module for NocoDB app routines.
 *
 * Two window globals are injected by the app shell at serve time:
 *   window.__nc_app_invoke_url__  absolute path the app POSTs routine invocations to
 *   window.__nc_app_user__        { id, email?, displayName?, role? }
 *
 * Import and use:
 *   import { ctx } from '@nocodb/app-ctx'
 *   const rows = await ctx.routines.myRoutine({ filter: 'active' })
 *   const me = ctx.user  // AppUser | undefined
 *
 * Single source of the app routine runtime — there is no backend duplicate.
 * Its browser↔broker contract is guarded by the backend unit test
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
    credentials: 'include',
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

export const ctx = {
  get user(): AppUser | undefined {
    return window.__nc_app_user__;
  },
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
