import { test } from '@playwright/test';
import setup, { unsetup } from '../../setup';
import { AccountPage } from '../../pages/Account';
import { spawn } from 'child_process';
import path from 'path';
import { SAMLLoginPage } from '../../pages/SsoIdpPage/SAMLLoginPage';

// todo: move to utils
let childProcess: ChildProcess;
const startSAMLIdp = async (env = {}) => {
  return new Promise((resolve, reject) => {
    try {
      childProcess = spawn('npm', ['start'], {
        cwd: path.join(__dirname, '../../../../scripts/ee/playwright/saml-provider'),
        env: {
          ...process.env,
          ...env,
        },
        detached: true,
      });

      childProcess.stdout.on('data', function (data) {
        const log = data.toString();
        console.log(log);
        if (log.includes('IdP server ready at')) resolve();
      });

      childProcess.stdout.on('error', function (data) {
        console.log('error: ' + data.toString());
        reject(data);
      });

      // set a timeout to reject promise if not resolved
      setTimeout(() => {
        reject('timeout');
      }, 10000);
    } catch (e) {
      console.log(e);
    }
  });
};

const stopSAMLIpd = async () => {
  process.kill(-childProcess.pid);
};

test.describe.serial('SSO SAML Auth Flow', () => {
  let accountsPage: AccountPage;
  let samlLoginPage: SAMLLoginPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });

    accountsPage = new AccountPage(page);
    await accountsPage.authentication.goto();

    // Create SAML provider
    await accountsPage.authentication.createSAMLProvider(
      {
        title: 'test',
        url: 'http://localhost:7000/metadata',
      },
      async ({ redirectUrl, audience }) => {
        await startSAMLIdp({
          REDIRECT_URL: redirectUrl,
          AUDIENCE: audience,
        });
      }
    );

    // Verify SAML provider count
    await accountsPage.authentication.verifySAMLProviderCount({ count: 1 });

    samlLoginPage = new SAMLLoginPage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
    await stopSAMLIpd();
  });

  test('SAML Provider', async () => {
    await accountsPage.signOut();

    await samlLoginPage.goto('test');

    await samlLoginPage.signIn({
      email: 'test@nocodb.com',
    });
  });
});
