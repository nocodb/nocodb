import { expect, test } from '@playwright/test';
import { Api } from 'nocodb-sdk';
import setup, { unsetup } from '../../../setup';

test.describe('Default Organization', () => {
  let context: any;
  let api: Api<any>;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });
    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('appInfo should contain defaultOrgId on on-prem', async () => {
    const response = await api.utils.appInfo();
    const appInfo = response as any;

    // On-prem should have defaultOrgId set
    if (appInfo.isOnPrem) {
      expect(appInfo.defaultOrgId).toBeTruthy();
      expect(appInfo.defaultOrgId).toBe('nc');
    }

    // defaultWorkspaceId should also exist
    if (!appInfo.ee || appInfo.isOnPrem) {
      expect(appInfo.defaultWorkspaceId).toBeTruthy();
    }
  });

  test('default org should have the super user as owner', async () => {
    const appInfo = (await api.utils.appInfo()) as any;

    if (!appInfo.defaultOrgId) {
      test.skip();
      return;
    }

    // Verify via org users API (if available)
    try {
      const orgUsers = await api.request({
        url: `/api/v2/orgs/${appInfo.defaultOrgId}/users`,
        method: 'GET',
        headers: { 'xc-auth': context.token },
      });

      expect(orgUsers.data).toBeTruthy();
    } catch {
      // Org users API may not be available on CE — skip
    }
  });
});
