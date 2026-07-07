// Public type surface for the @nocodb/app-ctx runtime package. The
// implementation is compiled from index.ts at image-build into index.js; this
// declaration is what app code type-checks against. Keep it in lockstep with
// the exports in index.ts.

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
  constructor(code: IntegrationErrorCode, message: string, detail?: unknown);
}

export const ctx: {
  readonly user: AppUser | undefined;
  routines: Record<string, (params?: unknown) => Promise<unknown>>;
};
