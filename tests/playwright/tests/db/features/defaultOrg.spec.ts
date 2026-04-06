import { expect, test } from '@playwright/test';
import setup, { unsetup } from '../../../setup';

test.describe('Default Organization', () => {
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('appInfo should contain defaultOrgId on licensed on-prem', async () => {
    const appInfo = context.appInfo || {};

    if (appInfo.isOnPrem && appInfo.ee) {
      expect(appInfo.defaultOrgId).toBeTruthy();
      expect(appInfo.defaultOrgId).toBe('org_default');
    } else if (appInfo.isOnPrem && !appInfo.ee) {
      expect(appInfo.defaultOrgId).toBeFalsy();
    }

    if (!appInfo.ee || appInfo.isOnPrem) {
      expect(appInfo.defaultWorkspaceId).toBeTruthy();
    }
  });

  test('user list should include org_roles on licensed on-prem', async ({ request }) => {
    const appInfo = context.appInfo || {};

    const response = await request.get('http://localhost:8080/api/v1/users?limit=10', {
      headers: { 'xc-auth': context.token },
    });

    const data = await response.json();
    const users = data.list || [];

    if (appInfo.isOnPrem && appInfo.ee && users.length > 0) {
      // Licensed on-prem: super admin should have org_roles
      const admin = users.find((u: any) => u.roles?.includes('super'));
      if (admin) {
        expect(admin.org_roles).toBe('cloud-org-level-owner');
      }
    }
  });

  test('org role update API works on licensed on-prem', async ({ request }) => {
    const appInfo = context.appInfo || {};

    if (!appInfo.isOnPrem || !appInfo.ee || !appInfo.defaultOrgId) {
      test.skip();
      return;
    }

    // Invite a test user
    await request.post('http://localhost:8080/api/v1/users', {
      headers: { 'xc-auth': context.token, 'Content-Type': 'application/json' },
      data: { email: `orgtest_${Date.now()}@test.com`, roles: 'org-level-creator' },
    });

    // Get users
    const listResp = await request.get('http://localhost:8080/api/v1/users?limit=50', {
      headers: { 'xc-auth': context.token },
    });
    const users = (await listResp.json()).list || [];
    const testUser = users.find((u: any) => u.email?.startsWith('orgtest_'));

    if (!testUser) {
      test.skip();
      return;
    }

    // Update role
    const updateResp = await request.patch(
      `http://localhost:8080/api/v1/orgs/${appInfo.defaultOrgId}/users/${testUser.id}`,
      {
        headers: { 'xc-auth': context.token, 'Content-Type': 'application/json' },
        data: { org_role: 'cloud-org-level-creator' },
      }
    );

    expect(updateResp.status()).toBe(200);
  });

  test('last admin cannot be removed from org', async ({ request }) => {
    const appInfo = context.appInfo || {};

    if (!appInfo.isOnPrem || !appInfo.ee || !appInfo.defaultOrgId) {
      test.skip();
      return;
    }

    // Get current user from user list
    const listResp = await request.get('http://localhost:8080/api/v1/users?limit=10', {
      headers: { 'xc-auth': context.token },
    });
    const users = (await listResp.json()).list || [];
    const admin = users.find((u: any) => u.org_roles === 'cloud-org-level-owner');

    if (!admin) {
      test.skip();
      return;
    }

    // Try to remove last admin — should fail with 400
    const deleteResp = await request.delete(
      `http://localhost:8080/api/v1/orgs/${appInfo.defaultOrgId}/users/${admin.id}`,
      { headers: { 'xc-auth': context.token } }
    );

    expect(deleteResp.status()).toBe(400);
  });
});
