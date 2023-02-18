import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';

export class ViewSidebarPage extends BasePage {
  readonly project: any;
  readonly dashboard: DashboardPage;
  readonly createGalleryButton: Locator;
  readonly createGridButton: Locator;
  readonly createFormButton: Locator;
  readonly createKanbanButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.createGalleryButton = this.get().locator('.nc-create-gallery-view:visible');
    this.createGridButton = this.get().locator('.nc-create-grid-view:visible');
    this.createFormButton = this.get().locator('.nc-create-form-view:visible');
    this.createKanbanButton = this.get().locator('.nc-create-kanban-view:visible');
  }

  get() {
    return this.dashboard.get().locator('.nc-view-sidebar');
  }

  async isVisible() {
    return await this.get().isVisible();
  }

  async verifyVisibility({ isVisible }: { isVisible: boolean }) {
    if (isVisible) {
      await expect(this.get()).toBeVisible();
    } else {
      await expect(this.get()).not.toBeVisible();
    }
  }

  async activateGeoDataEasterEgg() {
    await this.dashboard.rootPage.evaluate(_ => {
      window.localStorage.setItem('geodataToggleState', 'true');
    });
    await this.rootPage.goto(this.rootPage.url());

    // await this.rootPage.pause();

    // await this.rootPage.pause();
    // const toggleViewSidebarButton = await this.rootPage.$('.nc-toggle-right-navbar');
    // if (!(await this.get().isVisible())) {
    //   // await this.get().click();
    //   await toggleViewSidebarButton.click();
    // }
    // // await this.rootPage.pause();
    // // await this.verifyVisibility({ isVisible: true });
    // // await this.rootPage.pause();

    // // const element = await this.rootPage.$('.nc-active-btn');
    // const { x, y } = await toggleViewSidebarButton.boundingBox();
    // // Click the element 5 times in a row
    // for (let i = 0; i < 5; i++) {
    //   await this.rootPage.mouse.click(x + 10, y);
    // }

    // await this.rootPage.pause();
    // if (!(await this.get().isVisible())) {
    //   // await this.get().click();
    //   await toggleViewSidebarButton.click();
    // }
    // await this.rootPage.pause();
    // // await this.verifyVisibility({ isVisible: true });
    // await this.rootPage.pause();
    // await this.rootPage.getByTestId('toggle-geodata-feature-icon').click();
  }

  private async createView({ title, locator }: { title: string; locator: Locator }) {
    await locator.click();
    await this.rootPage.locator('input[id="form_item_title"]:visible').fill(title);
    const submitAction = () =>
      this.rootPage.locator('.ant-modal-content').locator('button:has-text("Submit"):visible').click();
    await this.waitForResponse({
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: '/api/v1/db/meta/tables/',
      uiAction: submitAction,
      responseJsonMatcher: json => json.title === title,
    });
    await this.verifyToast({ message: 'View created successfully' });
    // Todo: Wait for view to be rendered
    await this.rootPage.waitForTimeout(1000);
  }

  async createGalleryView({ title }: { title: string }) {
    await this.createView({ title, locator: this.createGalleryButton });
  }

  async createGridView({ title }: { title: string }) {
    await this.createView({ title, locator: this.createGridButton });
  }

  async createFormView({ title }: { title: string }) {
    await this.createView({ title, locator: this.createFormButton });
  }

  async openView({ title }: { title: string }) {
    await this.get().locator(`[data-testid="view-sidebar-view-${title}"]`).click();
  }

  async createKanbanView({ title }: { title: string }) {
    await this.createView({ title, locator: this.createKanbanButton });
  }

  // Todo: Make selection better
  async verifyView({ title, index }: { title: string; index: number }) {
    await expect(
      this.get().locator('[data-testid="view-item"]').nth(index).locator('[data-testid="truncate-label"]')
    ).toHaveText(title, { ignoreCase: true });
  }

  async verifyViewNotPresent({ title, index }: { title: string; index: number }) {
    const viewList = this.get().locator(`.nc-views-menu`).locator('.ant-menu-title-content');
    if ((await viewList.count()) <= index) {
      return true;
    }

    return await expect(
      this.get().locator(`.nc-views-menu`).locator('.ant-menu-title-content').nth(index)
    ).not.toHaveText(title);
  }

  async reorderViews({ sourceView, destinationView }: { sourceView: string; destinationView: string }) {
    await this.dashboard
      .get()
      .locator(`[data-testid="view-sidebar-drag-handle-${sourceView}"]`)
      .dragTo(this.get().locator(`[data-testid="view-sidebar-view-${destinationView}"]`));
  }

  async deleteView({ title }: { title: string }) {
    await this.get().locator(`[data-testid="view-sidebar-view-${title}"]`).hover();
    await this.get()
      .locator(`[data-testid="view-sidebar-view-actions-${title}"]`)
      .locator('.nc-view-delete-icon')
      .click();

    await this.rootPage.locator('.nc-modal-view-delete').locator('button:has-text("Submit"):visible').click();

    // waiting for button to get detached, we will miss toast
    // await this.rootPage
    //   .locator(".nc-modal-view-delete")
    //   .locator('button:has-text("Submit")')
    //   .waitFor({ state: "detached" });
    await this.verifyToast({ message: 'View deleted successfully' });
  }

  async renameView({ title, newTitle }: { title: string; newTitle: string }) {
    await this.get().locator(`[data-testid="view-sidebar-view-${title}"]`).dblclick();
    await this.get().locator(`[data-testid="view-sidebar-view-${title}"]`).locator('input').fill(newTitle);
    await this.get().press('Enter');
    await this.verifyToast({ message: 'View renamed successfully' });
  }

  async copyView({ title }: { title: string }) {
    await this.get().locator(`[data-testid="view-sidebar-view-${title}"]`).hover();
    await this.get()
      .locator(`[data-testid="view-sidebar-view-actions-${title}"]`)
      .locator('.nc-view-copy-icon')
      .click();
    const submitAction = () =>
      this.rootPage.locator('.ant-modal-content').locator('button:has-text("Submit"):visible').click();
    await this.waitForResponse({
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: '/api/v1/db/meta/tables/',
      uiAction: submitAction,
    });
    await this.verifyToast({ message: 'View created successfully' });
  }

  async changeViewIcon({ title, icon }: { title: string; icon: string }) {
    await this.get().locator(`[data-testid="view-sidebar-view-${title}"] .nc-view-icon`).click();

    await this.rootPage.getByTestId('nc-emoji-filter').type(icon);
    await this.rootPage.getByTestId('nc-emoji-container').locator(`.nc-emoji-item >> svg`).first().click();

    await this.rootPage.getByTestId('nc-emoji-container').isHidden();
    await expect(
      this.get().locator(`[data-testid="view-sidebar-view-${title}"] [data-testid="nc-icon-emojione:${icon}"]`)
    ).toHaveCount(1);
  }

  async verifyTabIcon({ title, icon }: { title: string; icon: string }) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await expect(
      this.rootPage.locator(
        `[data-testid="nc-tab-title"]:has-text("${title}") [data-testid="nc-tab-icon-emojione:${icon}"]`
      )
    ).toBeVisible();
  }

  async validateRoleAccess(param: { role: string }) {
    const count = param.role === 'creator' ? 1 : 0;
    await expect(this.createGridButton).toHaveCount(count);
    await expect(this.createGalleryButton).toHaveCount(count);
    await expect(this.createFormButton).toHaveCount(count);
    await expect(this.createKanbanButton).toHaveCount(count);
  }
}
