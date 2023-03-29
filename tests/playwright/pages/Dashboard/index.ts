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
import { MapPage } from './Map';
import { ImportAirtablePage } from './Import/Airtable';
import { ImportTemplatePage } from './Import/ImportTemplate';
import { WebhookFormPage } from './WebhookForm';
import { ProjectsPage } from '../ProjectsPage';
import { FindRowByScanOverlay } from './FindRowByScanOverlay';
import { SidebarPage } from './Sidebar';
import { DocsPageGroup } from './Docs';
import { ShareProjectButtonPage } from './ShareProjectButton';

export class DashboardPage extends BasePage {
  readonly project: any;
  readonly tablesSideBar: Locator;
  readonly projectMenuLink: Locator;
  readonly tabBar: Locator;
  readonly treeView: TreeViewPage;
  readonly grid: GridPage;
  readonly gallery: GalleryPage;
  readonly form: FormPage;
  readonly kanban: KanbanPage;
  readonly map: MapPage;
  readonly expandedForm: ExpandedFormPage;
  readonly webhookForm: WebhookFormPage;
  readonly findRowByScanOverlay: FindRowByScanOverlay;
  readonly childList: ChildList;
  readonly linkRecord: LinkRecord;
  readonly settings: SettingsPage;
  readonly viewSidebar: ViewSidebarPage;
  readonly importAirtable: ImportAirtablePage;
  readonly importTemplate = new ImportTemplatePage(this);
  readonly docs: DocsPageGroup;
  readonly sidebar: SidebarPage;
  readonly shareProjectButton: ShareProjectButtonPage;

  constructor(rootPage: Page, project: any) {
    super(rootPage);
    this.project = project;
    this.tablesSideBar = rootPage.locator('.nc-treeview-container');
    this.projectMenuLink = rootPage.getByTestId('nc-project-menu');
    this.tabBar = rootPage.locator('.nc-tab-bar');
    this.treeView = new TreeViewPage(this, project);
    this.grid = new GridPage(this);
    this.gallery = new GalleryPage(this);
    this.form = new FormPage(this);
    this.kanban = new KanbanPage(this);
    this.map = new MapPage(this);
    this.expandedForm = new ExpandedFormPage(this);
    this.webhookForm = new WebhookFormPage(this);
    this.findRowByScanOverlay = new FindRowByScanOverlay(this);
    this.childList = new ChildList(this);
    this.linkRecord = new LinkRecord(this);
    this.settings = new SettingsPage(this);
    this.viewSidebar = new ViewSidebarPage(this);
    this.importAirtable = new ImportAirtablePage(this);
    this.sidebar = new SidebarPage(this);
    this.docs = new DocsPageGroup(this);
    this.shareProjectButton = new ShareProjectButtonPage(this);
  }

  get() {
    return this.rootPage.locator('html');
  }

  async goto() {
    await this.rootPage.goto(`/#/nc/${this.project.id}/auth`);
  }

  getProjectMenuLink({ title }: { title: string }) {
    return this.rootPage.locator(`div.nc-project-menu-item:has-text("${title}")`);
  }

  async verifyTeamAndSettingsLinkIsVisible() {
    await this.projectMenuLink.click();
    const teamAndSettingsLink = await this.getProjectMenuLink({ title: ' Team & Settings' });
    await expect(teamAndSettingsLink).toBeVisible();
    await this.projectMenuLink.click();
  }

  async verifyTeamAndSettingsLinkIsNotVisible() {
    await this.projectMenuLink.click();
    const teamAndSettingsLink = await this.getProjectMenuLink({ title: ' Team & Settings' });
    await expect(teamAndSettingsLink).not.toBeVisible();
    await this.projectMenuLink.click();
  }

  async gotoSettings() {
    await this.rootPage.getByTestId('nc-project-menu').click();
    await this.rootPage.locator('div.nc-project-menu-item:has-text(" Team & Settings")').click();
  }

  async gotoProjectSubMenu({ title }: { title: string }) {
    await this.rootPage.getByTestId('nc-project-menu').click();
    await this.rootPage.locator(`div.nc-project-menu-item:has-text("${title}")`).click();
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
      if (title === 'Team & Auth') {
        await expect(this.rootPage).toHaveURL(`/#/nc/${this.project.id}/auth`);
      } else {
        await expect(this.rootPage).toHaveURL(new RegExp(`#/nc/${this.project.id}/table/md_.{14}`));
      }
    }
  }

  async toggleMobileMode() {
    await this.projectMenuLink.click();
    const projMenu = this.rootPage.locator('.nc-dropdown-project-menu');
    await projMenu.locator('[data-menu-id="mobile-mode"]:visible').click();
    await this.projectMenuLink.click();
  }

  async signOut() {
    await this.rootPage.getByTestId('nc-project-menu').click();
    const projMenu = this.rootPage.locator('.nc-dropdown-project-menu');
    await projMenu.locator('[data-menu-id="account"]:visible').click();
    await this.rootPage.locator('div.nc-project-menu-item:has-text("Sign Out"):visible').click();
    await this.rootPage.locator('[data-testid="nc-form-signin"]:visible').waitFor();
    await new Promise(resolve => setTimeout(resolve, 150));
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
