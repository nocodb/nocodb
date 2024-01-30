import { test } from '@playwright/test';
import setup, { unsetup } from '../../setup';
import { AccountPage } from '../../pages/Account';
import assert from 'assert';
import { exec } from 'child_process';
import path from 'path';
import { SAMLLoginPage } from '../../pages/SsoIdpPage/SAMLLoginPage';

// todo: move to utils
let childProcess: ChildProcess;
const startSAMLIdp = async () => {
  childProcess = exec(
    'npm install && npm run start',
    {
      cwd: path.join(__dirname, '../../../../scripts/ee/playwright/saml-provider'),
    },
    (error, stdout, stderr) => {
      console.log(`stdout: ${stdout}`);
      if (error !== null) {
        console.log(`exec error: ${error}`);
      }
    }
  );
  await new Promise(resolve => setTimeout(resolve, 5000));
};

const stopSAMLIpd = async () => {
  childProcess.kill();
};

test.describe.only('SSO SAML Auth Flow', () => {
  let accountsPage: AccountPage;
  let samlLoginPage: SAMLLoginPage;
  let context: any;

  test.beforeAll(async () => {
    await startSAMLIdp();
  });

  test.afterAll(async () => {
    await stopSAMLIpd();
  });

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    accountsPage = new AccountPage(page);
    samlLoginPage = new SAMLLoginPage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('SAML Provider', async () => {
    await accountsPage.authentication.goto();

    // Create SAML provider
    await accountsPage.authentication.createSAMLProvider({
      title: 'test',
      url: 'http://localhost:7000/metadata',
    });

    // Verify SAML provider count
    await accountsPage.authentication.verifySAMLProviderCount({ count: 1 });

    await accountsPage.signOut();

    await samlLoginPage.goto('test');

    await samlLoginPage.signIn({
      email: 'test@nocodb.com',
    });

    console.log('abc');
  });
});
