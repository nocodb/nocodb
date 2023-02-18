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
    await projectPage.createProject({ name: 'project-firstName', withoutPrefix: true });
    await dashboard.clickHome();
    await projectPage.renameProject({
      title: 'project-firstName',
      newTitle: 'project-rename',
      withoutPrefix: true,
    });
    await dashboard.clickHome();
    await projectPage.openProject({ title: 'project-rename', withoutPrefix: true });
    await dashboard.clickHome();
    await projectPage.deleteProject({ title: 'project-rename', withoutPrefix: true });
  });
});
