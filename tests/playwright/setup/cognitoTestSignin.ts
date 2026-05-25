/**
 * Opt-in helper for driving the `/auth/cognito` callback from playwright
 * without a real AWS Cognito User Pool configured.
 *
 * Backed by the test-mode shim in
 * `packages/nocodb/src/ee/strategies/cognito.strategy/cognito.strategy.ts`
 * — the strategy short-circuits when `process.env.TEST === 'true'` AND
 * the request carries the synthetic `xc-cognito-test` header.
 *
 * This file is intentionally NOT imported by any existing spec — it's
 * enabling infrastructure for the Cognito-2FA E2E coverage. Specs that
 * want to use it should import explicitly:
 *
 *   import { cognitoSigninAs } from '../../setup/cognitoTestSignin';
 *
 *   const res = await cognitoSigninAs(page, {
 *     email: 'user@example.com',
 *     displayName: 'Test User',
 *   });
 *
 * The shim is inert when `TEST !== 'true'`, so accidentally hitting this
 * against a non-test backend is a no-op (the real Cognito strategy runs
 * and rejects the request — fail closed).
 */
import type { APIResponse, Page } from '@playwright/test';

export interface CognitoSigninOptions {
  email: string;
  displayName?: string;
  /**
   * Force the first-time-user (register) branch on the backend even if
   * the email already exists. Useful for first-login telemetry tests.
   */
  firstTimeUser?: boolean;
  /**
   * Forwarded as `body.redirect` — the BE persists this into the 2FA
   * token so the FE can re-navigate after `/auth/mfa/verify`.
   */
  redirect?: string;
}

export async function cognitoSigninAs(page: Page, opts: CognitoSigninOptions): Promise<APIResponse> {
  const envelope = JSON.stringify({
    email: opts.email,
    displayName: opts.displayName,
    firstTimeUser: opts.firstTimeUser,
  });

  return page.request.post('/api/v2/auth/cognito', {
    data: opts.redirect ? { redirect: opts.redirect } : {},
    headers: {
      'xc-cognito-test': envelope,
      'Content-Type': 'application/json',
    },
  });
}
