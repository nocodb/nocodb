import { test } from '@playwright/test';
import setup, { unsetup } from '../../setup';
import { AccountPage } from '../../pages/Account';
import { OpenIDLoginPage } from '../../pages/SsoIdpPage/OpenIDLoginPage';
import { SAMLLoginPage } from '../../pages/SsoIdpPage/SAMLLoginPage';
import { startOpenIDIdp, startSAMLIdp, stopOpenIDIdp, stopSAMLIpd } from './utils/sso';
import { GoogleLoginPage } from '../../pages/SsoIdpPage/GoogleLoginPage';
import { OrgAdminPage } from '../../pages/OrgAdmin';
import { CloudOpenIDLoginPage } from '../../pages/OrgAdmin/OpenIDLoginPage';
import { CloudSAMLLoginPage } from '../../pages/OrgAdmin/SAMLLoginPage';
// generate random sub-domain of nocodb.com
const getDomain = () => `test-${Math.random().toString(36).substring(7)}.nocodb.com`;

// TODO: ENABLE - FAILS ON CI ONLY
test.describe.serial('SSO', () => {
  test.describe.serial('CRUD', () => {
    let accountsPage: AccountPage;
    let context: any;

    test.beforeEach(async ({ page }) => {
      context = await setup({ page, isEmptyProject: true, isSuperUser: true, resetSsoClients: true });
      accountsPage = new AccountPage(page);
    });

    test.afterEach(async () => {
      await unsetup(context);
    });

    test('SAML Provider', async () => {
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

      await accountsPage.authentication.verifyOIDCProviderCount({ count: 1 });

      // Disable OIDC provider
      await accountsPage.authentication.toggleProvider('oidc', 'test');

      // Enable OIDC provider
      await accountsPage.authentication.toggleProvider('oidc', 'test');

      // Delete OIDC provider
      await accountsPage.authentication.deleteProvider('oidc', 'test');
    });

    test('Google Auth', async () => {
      await accountsPage.authentication.goto();

      // Create OIDC provider
      await accountsPage.authentication.createGoogleProvider({
        clientId: 'test',
        clientSecret: 'test',
      });

      // Disable OIDC provider
      await accountsPage.authentication.toggleProvider('google', 'google');
      //
      // // Enable OIDC provider
      await accountsPage.authentication.toggleProvider('google', 'google');

      // Delete OIDC provider
      await accountsPage.authentication.deleteProvider('google', 'google');
    });
  });

  test.describe('OpenID Auth Flow', () => {
    let accountsPage: AccountPage;
    let openidLoginPage: OpenIDLoginPage;
    let context: any;

    test.beforeEach(async ({ page }) => {
      context = await setup({ page, isEmptyProject: true, isSuperUser: true, resetSsoClients: true });

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
      context = await setup({ page, isEmptyProject: true, isSuperUser: true, resetSsoClients: true });

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

  test.describe('Google Auth Flow', () => {
    let accountsPage: AccountPage;
    let googleLoginPage: GoogleLoginPage;
    let context: any;

    test.beforeEach(async ({ page }) => {
      context = await setup({ page, isEmptyProject: true, isSuperUser: true, resetSsoClients: true });

      accountsPage = new AccountPage(page);
      await accountsPage.authentication.goto();

      // Create SAML provider
      await accountsPage.authentication.createGoogleProvider({
        clientId: 'test',
        clientSecret: 'test',
      });

      // Verify SAML provider count

      googleLoginPage = new GoogleLoginPage(page);
    });

    test.afterEach(async () => {
      await unsetup(context);
    });

    test('Google Provider', async () => {
      await accountsPage.signOut();

      await googleLoginPage.goto('test');

      await googleLoginPage.signIn({
        email: 'test@nocodb.com',
      });
    });
  });

  test.describe.serial('Cloud - CRUD', () => {
    let orgAdminPage: OrgAdminPage;
    let context: any;
    const domain = getDomain();

    test.beforeEach(async ({ page }) => {
      context = await setup({ page, isEmptyProject: true, isSuperUser: true, resetSsoClients: true });
      orgAdminPage = new OrgAdminPage(page);
      await orgAdminPage.goto();
      await orgAdminPage.ssoPage.goto();
      await orgAdminPage.ssoPage.domain.addDomain(domain);
    });

    test.afterEach(async () => {
      await orgAdminPage.ssoPage.domain.deleteDomain(domain).catch(() => {
        // do nothing
      });
      await unsetup(context);
      await stopSAMLIpd();
    });

    test('SAML Provider', async () => {
      await orgAdminPage.ssoPage.goto();

      // Create SAML provider
      await orgAdminPage.ssoPage.createSAMLProvider(
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
      await orgAdminPage.ssoPage.verifySAMLProviderCount({ count: 1 });

      // Disable SAML provider
      await orgAdminPage.ssoPage.toggleProvider('saml', 'test');

      // Enable SAML provider
      await orgAdminPage.ssoPage.toggleProvider('saml', 'test');

      // Delete SAML provider
      await orgAdminPage.ssoPage.deleteProvider('saml', 'test');

      // Verify SAML provider count
      await orgAdminPage.ssoPage.verifySAMLProviderCount({
        count: 0,
      });
    });

    test('OIDC Provider', async () => {
      await orgAdminPage.ssoPage.goto();

      await orgAdminPage.ssoPage.deleteExistingClientIfAny('oidc', 'test');

      // Create OIDC provider
      await orgAdminPage.ssoPage.createOIDCProvider({
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

      await orgAdminPage.ssoPage.verifyOIDCProviderCount({ count: 1 });

      // Disable OIDC provider
      await orgAdminPage.ssoPage.toggleProvider('oidc', 'oidc');

      // Enable OIDC provider
      await orgAdminPage.ssoPage.toggleProvider('oidc', 'oidc');

      // Delete OIDC provider
      await orgAdminPage.ssoPage.deleteProvider('oidc', 'oidc');
    });

    /*    test('Google Auth', async () => {
        await orgAdminPage.ssoPage.goto();

        // Create OIDC provider
        await orgAdminPage.ssoPage.createGoogleProvider({
          clientId: 'test',
          clientSecret: 'test',
        });

        // Disable OIDC provider
        await orgAdminPage.ssoPage.toggleProvider('google', 'google');
        //
        // // Enable OIDC provider
        await orgAdminPage.ssoPage.toggleProvider('google', 'google');

        // Delete OIDC provider
        await orgAdminPage.ssoPage.deleteProvider('google', 'google');
      });*/
  });

  test.describe('Cloud - OpenID Auth Flow', () => {
    let openidLoginPage: CloudOpenIDLoginPage;
    let orgAdminPage: OrgAdminPage;
    let context: any;
    const domain = getDomain();

    test.beforeEach(async ({ page }) => {
      context = await setup({ page, isEmptyProject: true, isSuperUser: true, resetSsoClients: true });
      orgAdminPage = new OrgAdminPage(page);

      await orgAdminPage.goto();
      await orgAdminPage.ssoPage.goto();
      await orgAdminPage.ssoPage.domain.addDomain(domain);

      // Create SAML provider
      await orgAdminPage.ssoPage.createOIDCProvider(
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
      await orgAdminPage.ssoPage.verifyOIDCProviderCount({ count: 1 });

      openidLoginPage = new CloudOpenIDLoginPage(page);
    });

    test.afterEach(async () => {
      await unsetup(context);
      await stopOpenIDIdp();
    });

    test('OpenID Login Flow', async ({ page }) => {
      await openidLoginPage.goto('test', `test@${domain}`);

      await page.waitForURL(/localhost:4000/, { waitUntil: 'networkidle' });

      await openidLoginPage.signIn({
        email: `test@${domain}`,
      });
    });
  });

  test.describe('Cloud - SAML Auth Flow', () => {
    let orgAdminPage: OrgAdminPage;
    let samlLoginPage: CloudSAMLLoginPage;
    let context: any;
    const domain = getDomain();

    test.beforeEach(async ({ page }) => {
      context = await setup({ page, isEmptyProject: true, isSuperUser: true, resetSsoClients: true });

      orgAdminPage = new OrgAdminPage(page);
      await orgAdminPage.goto();
      await orgAdminPage.ssoPage.goto();
      await orgAdminPage.ssoPage.domain.addDomain(domain);

      // Create SAML provider
      await orgAdminPage.ssoPage.createSAMLProvider(
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
      await orgAdminPage.ssoPage.verifySAMLProviderCount({ count: 1 });

      samlLoginPage = new CloudSAMLLoginPage(page);
    });

    test.afterEach(async () => {
      await unsetup(context);
      await stopSAMLIpd();
    });

    test('SAML Provider', async () => {
      await samlLoginPage.goto('test', `test@${domain}`);

      await samlLoginPage.signIn({
        email: `test@${domain}`,
      });
    });
  });
});
