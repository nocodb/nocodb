import { test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { unsetup } from '../../setup';
import { AccountPage } from '../../pages/Account';
import assert from 'assert';

test.describe('SSO SAML', () => {
  let accountsPage: AccountPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });
    accountsPage = new AccountPage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('SAML Provider', async () => {
    await accountsPage.authentication.goto();

    // Create SAML provider
    await accountsPage.authentication.createSAMLProvider({
      title: 'test',
      url: 'https://samltest.id/saml/idp',
    });

    // Verify SAML provider count
    await accountsPage.authentication.verifySAMLProviderCount({ count: 1 });

    // Disable SAML provider
    await accountsPage.authentication.toggleProvider('saml', 'test');

    // Enable SAML provider
    await accountsPage.authentication.toggleProvider('saml', 'test');

    // Delete SAML provider
    await accountsPage.authentication.deleteProvider('saml', 'test');

    // Verify SAML provider count

    const samlProviderCount2 = await accountsPage.authentication.getSAMLProviderCount();
    assert.equal(samlProviderCount2, 0, 'SAML provider count is not 0');
  });

  test('OIDC Provider', async () => {
    await accountsPage.authentication.goto();

    // Create OIDC provider
    await accountsPage.authentication.createOIDCProvider({
      title: 'oidc',
      clientId: 'test',
      clientSecret: 'test',
      issuer: 'https://samltest.id/saml/idp',
      authUrl: 'https://samltest.id/saml/idp',
      tokenUrl: 'https://samltest.id/saml/idp',
      userInfoUrl: 'https://samltest.id/saml/idp',
      jwkUrl: 'https://samltest.id/saml/idp',
      scopes: ['openid'],
      userAttributes: 'test',
    });

    await accountsPage.authentication.verifyOIDCProviderCount({ count: 1 });

    // Disable OIDC provider
    await accountsPage.authentication.toggleProvider('oidc', 'oidc');

    // Enable OIDC provider
    await accountsPage.authentication.toggleProvider('oidc', 'oidc');

    // Delete OIDC provider
    await accountsPage.authentication.deleteProvider('oidc', 'oidc');
  });
});
