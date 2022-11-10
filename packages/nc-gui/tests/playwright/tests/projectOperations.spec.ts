import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';
import { ProjectsPage } from '../pages/ProjectsPage';

test.describe('Project operations', () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let context: any;
  let projectPage: ProjectsPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    projectPage = new ProjectsPage(page);
    toolbar = dashboard.grid.toolbar;
  });

  test('rename, delete', async () => {
    await dashboard.clickHome();
    await projectPage.createProject({ name: 'project-1', type: 'xcdb' });
    await dashboard.clickHome();
    await projectPage.renameProject({
      title: 'project-1',
      newTitle: 'project-new',
    });
    await dashboard.clickHome();
    await projectPage.openProject({ title: 'project-new' });
    await dashboard.clickHome();
    await projectPage.deleteProject({ title: 'project-new' });
  });
});
