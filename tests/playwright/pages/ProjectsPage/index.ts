import { expect, Page } from '@playwright/test';
import BasePage from '../Base';
import { DashboardPage } from '../Dashboard';

export class ProjectsPage extends BasePage {
  constructor(rootPage: Page) {
    super(rootPage);
  }

  prefixTitle(title: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${title}`;
  }

  get() {
    return this.rootPage.locator('[data-testid="projects-container"]');
  }

  // create project
  async createProject({ name = 'sample', withoutPrefix }: { name?: string; type?: string; withoutPrefix?: boolean }) {
    if (!withoutPrefix) name = this.prefixTitle(name);

    // Click "New Project" button
    await this.get().locator('.nc-new-project-menu').click();

    await this.rootPage.locator(`.nc-metadb-project-name`).waitFor();
    await this.rootPage.locator(`input.nc-metadb-project-name`).fill(name);

    const createProjectSubmitAction = () => this.rootPage.locator(`button:has-text("Create")`).click();
    await this.waitForResponse({
      uiAction: createProjectSubmitAction,
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: '/api/v1/db/meta/projects/',
    });

    // wait for dashboard to render
    await this.rootPage.locator('.nc-container').waitFor({ state: 'visible' });
  }

  // duplicate project
  async duplicateProject({
    name = 'sample',
    withoutPrefix,
  }: {
    name?: string;
    type?: string;
    withoutPrefix?: boolean;
  }) {
    if (!withoutPrefix) name = this.prefixTitle(name);
    // click three-dot
    await this.rootPage.getByTestId('p-three-dot-' + name).click();
    // check duplicate visible
    await expect(this.rootPage.getByTestId('dupe-project-' + name)).toBeVisible();
    // click duplicate
    await this.rootPage.getByTestId('dupe-project-' + name).click();
    // click duplicate confirmation "Do you want to duplicate 'sampleREST0' project?"
    // assert message on duplicate confirmation page
    const dupeProjectSubmitAction = () => this.rootPage.getByRole('button', { name: 'Yes' }).click();

    await this.waitForResponse({
      uiAction: dupeProjectSubmitAction,
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: 'api/v1/db/meta/duplicate/',
    });
    // wait for duplicate create completed and render kebab
    await this.get().locator(`[data-testid="p-three-dot-${name} copy"]`).waitFor();
  }

  async checkProjectCreateButton({ exists = true }) {
    await expect(this.rootPage.locator('.nc-new-project-menu:visible')).toHaveCount(exists ? 1 : 0);
  }

  async reloadProjects() {
    const reloadUiAction = () => this.get().locator('[data-testid="projects-reload-button"]').click();
    await this.waitForResponse({
      uiAction: reloadUiAction,
      requestUrlPathToMatch: '/api/v1/db/meta/projects',
      httpMethodsToMatch: ['GET'],
    });
  }

  async waitToBeRendered() {
    await this.get().waitFor({
      state: 'visible',
    });
    (await this.get().elementHandle())?.waitForElementState('stable');

    // Wait till the ant table is rendered
    await this.get().locator('thead.ant-table-thead >> th').nth(0).waitFor({ state: 'visible' });
    await expect(this.get().locator('thead.ant-table-thead >> th').nth(0)).toHaveText('Title');

    // todo: remove this, all the above asserts are useless.
    // The elements are actually invisible from screenshot but in dom level its visible. Lazy loading issue
    await this.rootPage.waitForTimeout(1200);
  }

  async openProject({
    title,
    withoutPrefix,
    waitForAuthTab = true,
  }: {
    title: string;
    withoutPrefix?: boolean;
    waitForAuthTab?: boolean;
  }) {
    if (!withoutPrefix) title = this.prefixTitle(title);

    let project: any;

    const openProjectUiAction = this.get()
      .locator(`.ant-table-cell`, {
        hasText: title,
      })
      .click();

    await Promise.all([
      this.rootPage.waitForResponse(async res => {
        let json: any = {};
        try {
          json = await res.json();
        } catch (e) {
          return false;
        }

        const isRequiredResponse =
          res.request().url().includes('/api/v1/db/meta/projects') &&
          ['GET'].includes(res.request().method()) &&
          json?.title === title;

        if (isRequiredResponse) {
          project = json;
        }

        return isRequiredResponse;
      }),
      openProjectUiAction,
    ]);

    const dashboard = new DashboardPage(this.rootPage, project);

    if (waitForAuthTab) await dashboard.waitForTabRender({ title: 'Team & Auth' });

    return project;
  }

  async deleteProject({ title, withoutPrefix }: { title: string; withoutPrefix?: boolean }) {
    if (!withoutPrefix) title = this.prefixTitle(title);

    await this.get().locator(`[data-testid="delete-project-${title}"]`).click();

    const deleteProjectAction = () => this.rootPage.locator(`button:has-text("Yes")`).click();
    await this.waitForResponse({
      uiAction: deleteProjectAction,
      httpMethodsToMatch: ['DELETE'],
      requestUrlPathToMatch: '/api/v1/db/meta/projects/',
    });

    await this.get().locator('.ant-table-row', { hasText: title }).waitFor({ state: 'hidden' });
  }

  async renameProject({
    title,
    newTitle,
    withoutPrefix,
  }: {
    title: string;
    newTitle: string;
    withoutPrefix?: boolean;
  }) {
    if (!withoutPrefix) title = this.prefixTitle(title);
    if (!withoutPrefix) newTitle = this.prefixTitle(newTitle);

    const project = this.rootPage;
    const projRow = await project.locator(`tr`, {
      has: project.locator(`td.ant-table-cell:has-text("${title}")`),
    });
    await projRow.locator('.nc-action-btn').nth(0).click();

    // there is a flicker; add delay to avoid flakiness
    await this.rootPage.waitForTimeout(1000);

    await project.locator('input.nc-metadb-project-name').fill(newTitle);
    // press enter to save
    const submitAction = () => project.locator('input.nc-metadb-project-name').press('Enter');
    await this.waitForResponse({
      uiAction: submitAction,
      requestUrlPathToMatch: 'api/v1/db/meta/projects/',
      httpMethodsToMatch: ['PATCH'],
    });
  }

  async openLanguageMenu() {
    await this.rootPage.locator('.nc-menu-translate').click();
  }

  async selectLanguage({ index }: { index: number }) {
    const modal = await this.rootPage.locator('.nc-dropdown-menu-translate');
    await modal.locator(`.ant-dropdown-menu-item`).nth(index).click();
  }

  async verifyLanguage(param: { json: any }) {
    const title = this.rootPage.locator(`.nc-project-page-title`);
    const menu = this.rootPage.locator(`.nc-new-project-menu`);
    await expect(title).toHaveText(param.json.title.myProject);
    await expect(menu).toHaveText(param.json.title.newProj);
    await this.rootPage.locator(`[placeholder="${param.json.activity.searchProject}"]`).waitFor();
  }

  async openPasswordChangeModal() {
    // open change password portal
    await this.rootPage.locator('.nc-menu-accounts').click();
    await this.rootPage
      .locator('.nc-dropdown-user-accounts-menu')
      .getByTestId('nc-menu-accounts__user-settings')
      .click();
  }

  async waitForRender() {
    await this.rootPage.locator('.nc-project-page-title:has-text("My Projects")').waitFor();
  }
}
