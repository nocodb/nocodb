import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup from '../../../setup';
import { getDefaultPwd } from '../../utils/general';
import { WorkspacePage } from '../../../pages/WorkspacePage';
import { Api } from 'nocodb-sdk';
import { CollaborationPage } from '../../../pages/WorkspacePage/CollaborationPage';

let api: Api<any>;

const roleDb = [
  { email: 'ws_creator@nocodb.com', role: 'creator' },
  { email: 'ws_editor@nocodb.com', role: 'editor' },
  { email: 'ws_commenter@nocodb.com', role: 'commenter' },
  { email: 'ws_viewer@nocodb.com', role: 'viewer' },
];

test.describe('Collaborators', () => {
  let dashboard: DashboardPage;
  let workspacePage: WorkspacePage;
  let collaborationPage: CollaborationPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    workspacePage = new WorkspacePage(page);
    collaborationPage = workspacePage.collaboration;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    for (let i = 0; i < roleDb.length; i++) {
      try {
        await api.auth.signup({
          email: roleDb[i].email,
          password: getDefaultPwd(),
        });
      } catch (e) {
        // ignore error even if user already exists
      }
    }

    await dashboard.leftSidebar.home.click();
  });

  test('Add different roles to WS', async () => {
    await workspacePage.Container.collaborators.click();

    for (let i = 0; i < roleDb.length; i++) {
      await collaborationPage.addUsers(roleDb[i].email, roleDb[i].role);
    }

    console.log('roleDb', roleDb);
  });
});
