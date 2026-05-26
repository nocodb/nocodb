import { expect, test } from '@playwright/test';
import axios from 'axios';
import setup, { NcContext, unsetup } from '../../setup';
import { DashboardPage } from '../../pages/Dashboard';
import { generateTotp } from '../utils/totp';

/**
 * Sign-in side of the 2FA flow: TOTP challenge on email/password
 * sign-in, backup-code recovery, and the `force_2fa` grace-mode
 * handoff that redirects un-enrolled users to Account → Security.
 *
 * The Cognito sign-in path is gated by infra we don't run in
 * playwright, but it shares mfaService.verifySignin /
 * mfaService.getTwoFactorTokenIfEnabled with the email/password
 * flow — so this coverage is meaningful for both.
 *
 * Each test self-cleans (disables MFA + clears force_2fa) so the next
 * worker's beforeEach finds the test owner in the expected state.
 */

const DEFAULT_PWD = 'Password123.';
const BASE = 'http://localhost:8080';

interface MfaSetupResponse {
  secret: string;
  qrUrl: string;
  backupCodes: string[];
}

/** Enrol the test owner in 2FA via the BE API (no UI involved). */
async function enrollMfaViaApi(token: string): Promise<MfaSetupResponse> {
  const headers = { 'xc-auth': token };

  // Step 1 — start setup with the owner's password.
  const setupRes = await axios.post(`${BASE}/api/v2/auth/mfa/setup`, { password: DEFAULT_PWD }, { headers });
  const data: MfaSetupResponse = setupRes.data;

  // Step 2 — verify with a freshly computed TOTP code. Server validates
  // against the secret we just received.
  const code = generateTotp(data.secret);
  await axios.post(`${BASE}/api/v2/auth/mfa/verify-setup`, { code }, { headers });

  return data;
}

/** Disable 2FA via API for the supplied auth token. */
async function disableMfaViaApi(token: string) {
  try {
    await axios.post(`${BASE}/api/v2/auth/mfa/disable`, { password: DEFAULT_PWD }, { headers: { 'xc-auth': token } });
  } catch {
    // already disabled — ignore
  }
}

/** Flip `meta.force_2fa` on a workspace via the BE API. */
async function setWorkspaceForce2fa(token: string, workspaceId: string, enabled: boolean) {
  // Fetch existing meta first so we don't clobber other flags.
  const ws = await axios.get(`${BASE}/api/v1/workspaces/${workspaceId}`, {
    headers: { 'xc-auth': token },
  });
  const existingMeta = typeof ws.data?.meta === 'string' ? JSON.parse(ws.data.meta) : ws.data?.meta ?? {};

  await axios.patch(
    `${BASE}/api/v1/workspaces/${workspaceId}`,
    { meta: { ...existingMeta, force_2fa: enabled } },
    { headers: { 'xc-auth': token } }
  );
}

/**
 * Sign in via UI and stop at the 2FA challenge screen. Does not
 * onboarding-flow / dashboard checks the standard `LoginPage.signIn`
 * uses, because those wait for the post-verify dashboard.
 */
async function signInToTwoFactorChallenge(page, email: string, password: string) {
  await page.goto('/signin');
  await page.waitForTimeout(1500);
  await page.getByTestId('nc-form-signin__email').waitFor();
  await page.getByTestId('nc-form-signin__email').fill(email);
  await page.getByTestId('nc-form-signin__password').fill(password);
  await page.getByTestId('nc-form-signin__submit').click();
  // TOTP entry input renders on success of the password-stage call.
  await page.getByTestId('nc-form-signin__2fa-code').waitFor({ state: 'visible', timeout: 10000 });
}

test.describe('Sign-in: 2FA challenge & recovery', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  // Track the secret captured during the test so afterEach can compute
  // a TOTP to refresh the auth token if the original was invalidated.
  let enrolledSecret: string | null = null;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    enrolledSecret = null;
  });

  test.afterEach(async () => {
    // Token rotation:
    //   - `verifySetup` rotates `token_version` → context.token is dead
    //     once the test enrols MFA via API.
    //   - The UI sign-in flow rotates the token again at verify time.
    // For cleanup we need a live token. We re-authenticate via the
    // sign-in endpoint, completing the TOTP challenge if the user
    // ended up enrolled. Falling back to the stale token is fine for
    // the force_2fa-only test which never enrolled.
    let workingToken: string | null = context.token;
    try {
      const signin = await axios.post(`${BASE}/api/v1/auth/user/signin`, {
        email: context.rootUser.email,
        password: DEFAULT_PWD,
      });
      if (signin.data?.twoFactorRequired && enrolledSecret) {
        const code = generateTotp(enrolledSecret);
        const verify = await axios.post(`${BASE}/api/v2/auth/mfa/verify`, {
          token: signin.data.twoFactorToken,
          code,
        });
        workingToken = verify.data?.token ?? workingToken;
      } else if (signin.data?.token) {
        workingToken = signin.data.token;
      }
    } catch {
      // Fall back to the stale token — disable/patch below will be
      // best-effort.
    }

    try {
      if (workingToken) {
        await disableMfaViaApi(workingToken);
      }
    } catch {
      // ignore
    }
    try {
      if (context.workspace?.id && workingToken) {
        await setWorkspaceForce2fa(workingToken, context.workspace.id, false);
      }
    } catch {
      // ignore
    }
    await unsetup(context);
  });

  test('TOTP entry on sign-in lands on dashboard', async ({ page }) => {
    const { secret } = await enrollMfaViaApi(context.token);
    enrolledSecret = secret;

    // Sign out via UI, then sign back in — should hit the TOTP screen.
    await dashboard.signOut();
    await signInToTwoFactorChallenge(page, context.rootUser.email, DEFAULT_PWD);

    // Compute fresh TOTP and submit.
    const totp = generateTotp(secret);
    await page.getByTestId('nc-form-signin__2fa-code').fill(totp);
    await page.getByTestId('nc-form-signin__2fa-submit').click();

    // Verify lands on dashboard — wait for sidebar or home sidebar.
    await page
      .locator('[data-testid="nc-sidebar-userinfo"], .nc-home-sidebar, .nc-treeview-container')
      .first()
      .waitFor({ timeout: 30000 });
  });

  test('Backup code recovery on sign-in lands on dashboard', async ({ page }) => {
    const { secret, backupCodes } = await enrollMfaViaApi(context.token);
    enrolledSecret = secret;
    expect(backupCodes.length).toBeGreaterThan(0);
    const aBackupCode = backupCodes[0];

    await dashboard.signOut();
    await signInToTwoFactorChallenge(page, context.rootUser.email, DEFAULT_PWD);

    // Toggle to backup-code mode.
    await page.getByTestId('nc-form-signin__2fa-toggle-backup').click();

    // Submit the backup code.
    await page.getByTestId('nc-form-signin__2fa-code').fill(aBackupCode);
    await page.getByTestId('nc-form-signin__2fa-submit').click();

    // Verify lands on dashboard.
    await page
      .locator('[data-testid="nc-sidebar-userinfo"], .nc-home-sidebar, .nc-treeview-container')
      .first()
      .waitFor({ timeout: 30000 });
  });

  test('force_2fa grace-mode redirects to Account → Security', async ({ page }) => {
    // Test owner has no MFA enabled — exactly the case the grace
    // redirect was added to handle. Flip the workspace's force_2fa via
    // API so the gate fires without going through the UI (which would
    // dismiss the toggle's confirm modal and may PATCH the wrong way).
    await setWorkspaceForce2fa(context.token, context.workspace.id, true);

    // Trigger any workspace-scoped API call. Re-loading the dashboard
    // page hits multiple `ncWorkspaceId` routes; the API interceptor
    // catches the 403 + ERR_MFA_SETUP_REQUIRED and shows the dialog.
    await page.goto(`/${context.workspace.id}/${context.base.id}`);

    const dlg = page.getByTestId('nc-2fa-setup-required-dlg');
    await dlg.waitFor({ state: 'visible', timeout: 15000 });

    // Click "Set up" → routes to /account/security?openEnrollment=true.
    await dlg.locator('.nc-modal-confirm-ok-btn').click();

    // Wait for the URL change. `router.replace` in Security.vue strips
    // `?openEnrollment=true` after consuming it, so we may catch the
    // bare path or the queried form depending on race. The password-
    // modal check below is the actual user-visible assertion.
    await page.waitForURL(/\/account\/security/, { timeout: 15000 });

    // The enrollment modal auto-opens with the password step.
    await page.getByTestId('nc-2fa-setup-password').waitFor({ state: 'visible', timeout: 15000 });

    // Cleanup happens in afterEach (flips force_2fa off via API) so the
    // next test's owner isn't locked out of their own workspace.
  });
});
