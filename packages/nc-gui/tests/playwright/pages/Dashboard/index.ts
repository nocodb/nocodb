import { expect, Locator, Page } from '@playwright/test';
import BasePage from '../Base';
import { GridPage } from './Grid';
import { FormPage } from './Form';
import { ExpandedFormPage } from './ExpandedForm';
import { ChildList } from './Grid/Column/LTAR/ChildList';
import { LinkRecord } from './Grid/Column/LTAR/LinkRecord';
import { TreeViewPage } from './TreeView';
import { SettingsPage } from './Settings';
import { ViewSidebarPage } from './ViewSidebar';
import { GalleryPage } from './Gallery';
import { KanbanPage } from './Kanban';
import { ImportAirtablePage } from './Import/Airtable';
import { ImportTemplatePage } from './Import/ImportTemplate';
import { WebhookFormPage } from './WebhookForm';
import { ProjectsPage } from '../ProjectsPage';

export class DashboardPage extends BasePage {
  readonly project: any;
  readonly tablesSideBar: Locator;
  readonly tabBar: Locator;
  readonly treeView: TreeViewPage;
  readonly grid: GridPage;
  readonly gallery: GalleryPage;
  readonly form: FormPage;
  readonly kanban: KanbanPage;
  readonly expandedForm: ExpandedFormPage;
  readonly webhookForm: WebhookFormPage;
  readonly childList: ChildList;
  readonly linkRecord: LinkRecord;
  readonly settings: SettingsPage;
  readonly viewSidebar: ViewSidebarPage;
  readonly importAirtable: ImportAirtablePage;
  readonly importTemplate = new ImportTemplatePage(this);

  constructor(rootPage: Page, project: any) {
    super(rootPage);
    this.project = project;
    this.tablesSideBar = rootPage.locator('.nc-treeview-container');
    this.tabBar = rootPage.locator('.nc-tab-bar');
    this.treeView = new TreeViewPage(this, project);
    this.grid = new GridPage(this);
    this.gallery = new GalleryPage(this);
    this.form = new FormPage(this);
    this.kanban = new KanbanPage(this);
    this.expandedForm = new ExpandedFormPage(this);
    this.webhookForm = new WebhookFormPage(this);
    this.childList = new ChildList(this);
    this.linkRecord = new LinkRecord(this);
    this.settings = new SettingsPage(this);
    this.viewSidebar = new ViewSidebarPage(this);
    this.importAirtable = new ImportAirtablePage(this);
  }

  get() {
    return this.rootPage.locator('html');
  }

  async goto() {
    await this.rootPage.goto(`/#/nc/${this.project.id}/auth`);
  }

  async gotoSettings() {
    await this.rootPage.locator('[data-testid="nc-project-menu"]').click();
    await this.rootPage.locator('div.nc-project-menu-item:has-text(" Team & Settings")').click();
  }

  async verifyInTabBar({ title }: { title: string }) {
    await this.tabBar.textContent().then(text => expect(text).toContain(title));
  }

  async closeTab({ title }: { title: string }) {
    const tab = this.tabBar.locator(`.ant-tabs-tab:has-text("${title}")`);
    await tab.locator('button.ant-tabs-tab-remove').click();

    // fix me!
    // await tab.waitFor({ state: "detached" });
    await this.rootPage.waitForTimeout(2000);
  }

  async clickHome() {
    // todo: Fast page transition breaks the vue router
    await this.rootPage.waitForTimeout(2000);

    await this.rootPage.getByTestId('nc-noco-brand-icon').click();
    const projectsPage = new ProjectsPage(this.rootPage);
    await projectsPage.waitToBeRendered();
  }

  // When a tab is opened, it is not always immediately visible.
  // Hence will wait till contents are visible
  async waitForTabRender({ title, mode = 'standard' }: { title: string; mode?: string }) {
    if (title === 'Team & Auth') {
      await this.get()
        .locator('div[role="tab"]', {
          hasText: 'Users Management',
        })
        .waitFor({
          state: 'visible',
        });
    } else {
      await this.get().getByTestId('grid-id-column').waitFor({
        state: 'visible',
      });
    }

    await this.tabBar.locator(`.ant-tabs-tab-active:has-text("${title}")`).waitFor();

    // wait active tab animation to finish
    await expect
      .poll(async () => {
        return await this.tabBar.getByTestId(`nc-root-tabs-${title}`).evaluate(el => {
          return window.getComputedStyle(el).getPropertyValue('color');
        });
      })
      .toBe('rgb(67, 81, 232)'); // active tab text color

    await this.get().getByTestId('grid-load-spinner').waitFor({ state: 'hidden' });

    if (mode === 'standard') {
      await expect(this.rootPage).toHaveURL(
        `/#/nc/${this.project.id}/${title === 'Team & Auth' ? 'auth' : `table/${title}`}`
      );
    }
  }

  async openPasswordChangeModal() {
    // open change password portal
    await this.rootPage.locator('.nc-menu-accounts').click();
    await this.rootPage
      .locator('.nc-dropdown-user-accounts-menu')
      .getByTestId('nc-menu-accounts__user-settings')
      .click();
  }

  // todo: Move this to a seperate page
  async changePassword({ oldPass, newPass, repeatPass }: { oldPass: string; newPass: string; repeatPass: string }) {
    // change password
    const currentPassword = this.rootPage.locator('input[data-testid="nc-user-settings-form__current-password"]');
    const newPassword = this.rootPage.locator('input[data-testid="nc-user-settings-form__new-password"]');
    const confirmPassword = this.rootPage.locator('input[data-testid="nc-user-settings-form__new-password-repeat"]');

    await currentPassword.fill(oldPass);
    await newPassword.fill(newPass);
    await confirmPassword.fill(repeatPass);

    await this.rootPage.locator('button[data-testid="nc-user-settings-form__submit"]').click();
  }

  async signOut() {
    await this.rootPage.locator('[data-testid="nc-project-menu"]').click();
    const projMenu = await this.rootPage.locator('.nc-dropdown-project-menu');
    await projMenu.locator('[data-menu-id="account"]:visible').click();
    await this.rootPage.locator('div.nc-project-menu-item:has-text("Sign Out"):visible').click();
    await this.rootPage.locator('[data-testid="nc-form-signin"]:visible').waitFor();
  }

  async validateProjectMenu(param: { role: string; mode?: string }) {
    await this.rootPage.locator('[data-testid="nc-project-menu"]').click();
    const pMenu = this.rootPage.locator(`.nc-dropdown-project-menu:visible`);

    // menu items
    let menuItems = {
      creator: [
        'Copy Project Info',
        'Swagger: REST APIs',
        'Copy Auth Token',
        'Team & Settings',
        'Themes',
        'Preview as',
        'Language',
        'Account',
      ],
      editor: ['Copy Project Info', 'Swagger: REST APIs', 'Copy Auth Token', 'Language', 'Account'],
      commenter: ['Copy Project Info', 'Copy Auth Token', 'Language', 'Account'],
      viewer: ['Copy Project Info', 'Copy Auth Token', 'Language', 'Account'],
    };

    if (param?.mode === 'shareBase') {
      menuItems = {
        creator: [],
        commenter: [],
        editor: ['Language'],
        viewer: ['Language'],
      };
    }

    // common items

    for (const item of menuItems[param.role]) {
      await expect(pMenu).toContainText(item);
    }
    await this.rootPage.locator('[data-testid="nc-project-menu"]').click();
  }

  // Wait for the loader i.e the loader than appears when rows are being fetched, saved etc on the top right of dashboard
  async waitForLoaderToDisappear() {
    await this.rootPage.locator('[data-testid="nc-loading"]').waitFor({ state: 'hidden' });
  }
}
