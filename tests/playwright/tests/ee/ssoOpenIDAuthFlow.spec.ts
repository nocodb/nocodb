import { test } from '@playwright/test';
import setup, { unsetup } from '../../setup';
import { AccountPage } from '../../pages/Account';
import { spawn } from 'child_process';
import path from 'path';
import { OpenIDLoginPage } from '../../pages/SsoIdpPage/OpenIDLoginPage';

// todo: move to utils
let childProcess: ChildProcess;
const startSAMLIdp = async (env = {}) => {
  return new Promise((resolve, reject) => {
    try {
      childProcess = spawn('npm', ['start'], {
        cwd: path.join(__dirname, '../../../../scripts/ee/playwright/openid-provider'),
        env: {
          ...process.env,
          ...env,
        },
        detached: true,
      });

      childProcess.stdout.on('data', function (data) {
        const log = data.toString();
        console.log(log);
        if (log.includes('oidc-provider listening on port 4000')) resolve();
      });

      childProcess.stdout.on('error', function (data) {
        console.log(data.toString());
        reject(data);
      });

      // set a timeout to reject promise if not resolved
      setTimeout(() => {
        reject('timeout');
      }, 20000);
    } catch (e) {
      console.log(e);
    }
  });
};

const stopSAMLIpd = async () => {
  process.kill(-childProcess.pid);
};

test.describe.serial('SSO OpenID Auth Flow', () => {
  let accountsPage: AccountPage;
  let openidLoginPage: OpenIDLoginPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });

    accountsPage = new AccountPage(page);
    await accountsPage.authentication.goto();

    // Create SAML provider
    await accountsPage.authentication.createOIDCProvider(
      {
        title: 'test',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        issuer: 'http://localhost:4000',
        authUrl: 'http://localhost:4000/auth',
        userInfoUrl: 'http://localhost:4000/me',
        tokenUrl: 'http://localhost:4000/token',
        jwkUrl: 'http://localhost:4000/certs',
        scopes: ['openid', 'profile', 'email'],
        userAttributes: 'id,email,first_name,last_name',
      },
      async ({ redirectUrl }) => {
        await startSAMLIdp({
          CLIENT_ID: 'test-client',
          CLIENT_SECRET: 'test-secret',
          CLIENT_REDIRECT_URI: redirectUrl,
          CLIENT_LOGOUT_REDIRECT_URI: redirectUrl,
        });
      }
    );

    // Verify SAML provider count
    await accountsPage.authentication.verifyOIDCProviderCount({ count: 1 });

    openidLoginPage = new OpenIDLoginPage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
    await stopSAMLIpd();
  });

  test('OpenID Login Flow', async () => {
    await accountsPage.signOut();

    await openidLoginPage.goto('test');

    await openidLoginPage.signIn({
      email: 'test@nocodb.com',
    });
  });
});
