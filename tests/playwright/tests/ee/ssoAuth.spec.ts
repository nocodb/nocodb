import { test } from '@playwright/test';
import setup, { unsetup } from '../../setup';
import { AccountPage } from '../../pages/Account';
import { OpenIDLoginPage } from '../../pages/SsoIdpPage/OpenIDLoginPage';
import { SAMLLoginPage } from '../../pages/SsoIdpPage/SAMLLoginPage';
import { startOpenIDIdp, startSAMLIdp, stopOpenIDIdp, stopSAMLIpd } from './utils/sso';

test.describe.serial('SSO', () => {
  test.describe('CRUD', () => {
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
      await accountsPage.authentication.verifySAMLProviderCount({
        count: 0,
      });
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

  test.describe('OpenID Auth Flow', () => {
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
          await startOpenIDIdp({
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
      await stopOpenIDIdp();
    });

    test('OpenID Login Flow', async () => {
      await accountsPage.signOut();

      await openidLoginPage.goto('test');

      await openidLoginPage.signIn({
        email: 'test@nocodb.com',
      });
    });
  });

  test.describe('SAML Auth Flow', () => {
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
});
