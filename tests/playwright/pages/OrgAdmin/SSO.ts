import BasePage from '../Base';
import { ProjectsPage } from '../ProjectsPage';
import { expect } from '@playwright/test';
import { Domain } from './Domain';
import { OrgAdminPage } from './index';

export class CloudSSO extends BasePage {
  readonly projectsPage: ProjectsPage;
  readonly domain: Domain;
  readonly orgAdminPage: OrgAdminPage;

  constructor(orgAdminPage: OrgAdminPage) {
    super(orgAdminPage.rootPage);
    this.domain = new Domain(orgAdminPage);
    this.orgAdminPage = orgAdminPage;
  }

  async goto() {
    // wait for 2 seconds to make sure the page is loaded
    // await this.rootPage.waitForTimeout(2000);
    // console.log(await this.rootPage.locator('[data-test-id="nc-org-sso-settings"]').count());
    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('[data-test-id="nc-org-sso-settings"]').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: '/api/v2/orgs/',
    });
  }

  get() {
    return this.rootPage.locator('html');
  }

  async verifySAMLProviderCount({ count }: { count: number }) {
    await expect.poll(async () => await this.get().locator('.nc-saml-provider').count()).toBe(count);
  }

  async verifyOIDCProviderCount({ count }: { count: number }) {
    await expect.poll(async () => await this.get().locator('.nc-oidc-provider').count()).toBe(count);
  }
  async deleteExistingClientIfAny(provider: 'saml' | 'oidc' | 'google', title: string) {
    if (
      !(await this.rootPage
        .locator(provider === 'google' ? '.nc-google-more-option' : `.nc-${provider}-${title}-more-option`)
        .count())
    )
      return;

    await this.deleteProvider(provider, title);
  }

  async getProvider(provider: 'saml' | 'oidc', title: string) {
    return this.rootPage.locator(`[data-test-id="nc-${provider}-provider-${title}"]`);
  }

  async deleteProvider(provider: 'saml' | 'oidc' | 'google', title: string) {
    await this.rootPage
      .locator(provider === 'google' ? '.nc-google-more-option' : `.nc-${provider}-${title}-more-option`)
      .click();
    await this.waitForResponse({
      uiAction: () => this.rootPage.locator(`[data-test-id="nc-${provider}-delete"]`).click(),
      httpMethodsToMatch: ['DELETE'],
      requestUrlPathToMatch: /\/api\/v2\/orgs\/\w+\/sso-client/,
    });
  }

  async toggleProvider(provider: 'saml' | 'oidc' | 'google', title: string) {
    await this.waitForResponse({
      uiAction: () => this.get().locator(`.nc-${provider}-${title}-enable .nc-switch`).click(),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: /\/api\/v2\/orgs\/\w+\/sso-client/,
    });
  }

  async selectScope({ type }: { type: string[] }) {
    await this.rootPage.locator('.ant-select-selector').click();

    await this.rootPage.locator('.ant-select-selection-search-input[aria-expanded="true"]').waitFor();
    for (const t of type) {
      await this.rootPage.locator('.rc-virtual-list-holder-inner > div').locator(`text="${t}"`).click();
    }
  }

  async createSAMLProvider(
    p: { title: string; url?: string; xml?: string },
    setupRedirectUrlCbk?: (params: { redirectUrl: string; audience: string }) => Promise<void>
  ) {
    const newSamlBtn = this.get().locator('[data-test-id="nc-new-saml-provider"]');

    await newSamlBtn.click();

    const samlModal = this.rootPage.locator('.nc-saml-modal');

    // wait until redirect url is generated
    await samlModal.locator('[data-test-id="nc-saml-redirect-url"]:has-text("http://")').waitFor();

    if (setupRedirectUrlCbk) {
      const redirectUrl = (
        await samlModal.locator('[data-test-id="nc-saml-redirect-url"]:has-text("http://")').textContent()
      ).trim();
      const audience = (
        await samlModal.locator('[data-test-id="nc-saml-issuer-url"]:has-text("http://")').textContent()
      ).trim();
      await setupRedirectUrlCbk({ redirectUrl, audience });
    }

    await samlModal.locator('[data-test-id="nc-saml-title"]').fill(p.title);
    if (p.url) {
      await samlModal.locator('[data-test-id="nc-saml-metadata-url"]').fill(p.url);
    }
    if (p.xml) {
      await samlModal.locator('[data-test-id="nc-saml-xml"]').fill(p.xml);
    }

    await this.waitForResponse({
      uiAction: () => samlModal.locator('[data-test-id="nc-saml-submit"]').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: /\/api\/v2\/orgs\/\w+\/sso-clients/,
    });
  }

  async createOIDCProvider(
    p: {
      issuer: string;
      title: string;
      clientId: string;
      clientSecret: string;
      authUrl: string;
      userInfoUrl: string;
      tokenUrl: string;
      jwkUrl: string;
      scopes: Array<string>;
      userAttributes: string;
    },
    setupRedirectUrlCbk?: (params: { redirectUrl: string }) => Promise<void>
  ) {
    const newOIDCBtn = this.get().locator('[data-test-id="nc-new-oidc-provider"]');

    await newOIDCBtn.click();

    const oidcModal = this.rootPage.locator('.nc-oidc-modal');

    // wait until redirect url is generated
    await oidcModal.locator('[data-test-id="nc-openid-redirect-url"]:has-text("http://")').waitFor();

    if (setupRedirectUrlCbk) {
      const redirectUrl = (
        await oidcModal.locator('[data-test-id="nc-openid-redirect-url"]:has-text("http://")').textContent()
      ).trim();
      await setupRedirectUrlCbk({ redirectUrl });
    }

    await oidcModal.locator('[data-test-id="nc-oidc-title"]').fill(p.title);

    await oidcModal.locator('[data-test-id="nc-oidc-issuer"]').fill(p.issuer);

    await oidcModal.locator('[data-test-id="nc-oidc-client-id"]').fill(p.clientId);

    await oidcModal.locator('[data-test-id="nc-oidc-client-secret"]').fill(p.clientSecret);

    await oidcModal.locator('[data-test-id="nc-oidc-auth-url"]').fill(p.authUrl);

    await oidcModal.locator('[data-test-id="nc-oidc-token-url"]').fill(p.tokenUrl);

    await oidcModal.locator('[data-test-id="nc-oidc-user-info-url"]').fill(p.userInfoUrl);

    await oidcModal.locator('[data-test-id="nc-oidc-jwk-url"]').fill(p.jwkUrl);

    await this.selectScope({
      type: p.scopes,
      locator: oidcModal.locator('[data-test-id="nc-oidc-scope"]'),
    } as any);

    await oidcModal.locator('[data-test-id="nc-oidc-user-attribute"]').fill(p.userAttributes);

    await this.waitForResponse({
      uiAction: () => oidcModal.locator('[data-test-id="nc-oidc-save-btn"]').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: /\/api\/v2\/orgs\/\w+\/sso-clients/,
    });
  }

  async createGoogleProvider(p: { clientId: string; clientSecret: string }) {
    await this.rootPage.locator(`.nc-google-more-option`).click();
    await this.rootPage.locator(`[data-test-id="nc-google-edit"]`).click();

    const googleModal = this.rootPage.locator('.nc-google-modal');
    // wait until redirect url is generated
    await googleModal.locator('[data-test-id="nc-google-redirect-url"]:has-text("http://")').waitFor();

    await googleModal.locator('[data-test-id="nc-google-client-id"]').fill(p.clientId);

    await googleModal.locator('[data-test-id="nc-google-client-secret"]').fill(p.clientSecret);

    await this.waitForResponse({
      uiAction: () => googleModal.locator('[data-test-id="nc-google-save-btn"]').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: /\/api\/v2\/orgs\/\w+\/sso-clients/,
    });
  }
}
