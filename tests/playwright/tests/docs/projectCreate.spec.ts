import { test } from '@playwright/test';
import { ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup from '../../setup';

test.describe('Create docs project and verify docs UI', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    dashboard = new DashboardPage(page, context.project);
  });

  test.only('Create docs project', async ({ page }) => {
    await dashboard.sidebar.createProject({
      title: 'test-docs',
      type: ProjectTypes.DOCUMENTATION,
    });
    await dashboard.docs.pagesList.verifyProjectTitle({ title: 'test-docs' });
  });
});
