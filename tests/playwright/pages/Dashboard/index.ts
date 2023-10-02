import { expect, Locator, Page } from '@playwright/test';
import BasePage from '../Base';
import { GridPage } from './Grid';
import { FormPage } from './Form';
import { ExpandedFormPage } from './ExpandedForm';
import { BulkUpdatePage } from './BulkUpdate';
import { ChildList } from './Grid/Column/LTAR/ChildList';
import { LinkRecord } from './Grid/Column/LTAR/LinkRecord';
import { TreeViewPage } from './TreeView';
import { SettingsPage } from './Settings';
import { ViewSidebarPage } from './ViewSidebar';
import { LeftSidebarPage } from './common/LeftSidebar';
import { ProjectViewPage } from './ProjectView';
import { GalleryPage } from './Gallery';
import { KanbanPage } from './Kanban';
import { MapPage } from './Map';
import { ImportAirtablePage } from './Import/Airtable';
import { ImportTemplatePage } from './Import/ImportTemplate';
import { WebhookFormPage } from './WebhookForm';
import { FindRowByScanOverlay } from './FindRowByScanOverlay';
import { SidebarPage } from './Sidebar';
import { DocsPageGroup } from './Docs';
import { ShareProjectButtonPage } from './ShareProjectButton';
import { ProjectTypes } from 'nocodb-sdk';
import { WorkspacePage } from '../WorkspacePage';
import { DetailsPage } from './Details';
import { WorkspaceSettingsObject } from './WorkspaceSettings';
import { CmdJ } from './Command/CmdJPage';
import { CmdK } from './Command/CmdKPage';
import { CmdL } from './Command/CmdLPage';

export class DashboardPage extends BasePage {
  readonly base: any;
  readonly tablesSideBar: Locator;
  readonly baseMenuLink: Locator;
  readonly workspaceMenuLink: Locator;
  readonly tabBar: Locator;
  readonly treeView: TreeViewPage;
  readonly grid: GridPage;
  readonly gallery: GalleryPage;
  readonly form: FormPage;
  readonly kanban: KanbanPage;
  readonly map: MapPage;
  readonly expandedForm: ExpandedFormPage;
  readonly bulkUpdateForm: BulkUpdatePage;
  readonly webhookForm: WebhookFormPage;
  readonly findRowByScanOverlay: FindRowByScanOverlay;
  readonly childList: ChildList;
  readonly linkRecord: LinkRecord;
  readonly settings: SettingsPage;
  readonly viewSidebar: ViewSidebarPage;
  readonly leftSidebar: LeftSidebarPage;
  readonly baseView: ProjectViewPage;
  readonly importAirtable: ImportAirtablePage;
  readonly importTemplate = new ImportTemplatePage(this);
  readonly docs: DocsPageGroup;
  readonly sidebar: SidebarPage;
  readonly shareProjectButton: ShareProjectButtonPage;
  readonly details: DetailsPage;
  readonly workspaceSettings: WorkspaceSettingsObject;
  readonly cmdJ: CmdJ;
  readonly cmdK: CmdK;
  readonly cmdL: CmdL;

  constructor(rootPage: Page, base: any) {
    super(rootPage);
    this.base = base;
    this.tablesSideBar = rootPage.locator('.nc-treeview-container');
    this.workspaceMenuLink = rootPage.getByTestId('nc-base-menu');
    this.baseMenuLink = rootPage
      .locator(`.base-title-node:has-text("${base.title}")`)
      .locator('[data-testid="nc-sidebar-context-menu"]')
      .first();
    this.tabBar = rootPage.locator('.nc-tab-bar');
    this.treeView = new TreeViewPage(this, base);
    this.grid = new GridPage(this);
    this.gallery = new GalleryPage(this);
    this.form = new FormPage(this);
    this.kanban = new KanbanPage(this);
    this.map = new MapPage(this);
    this.expandedForm = new ExpandedFormPage(this);
    this.bulkUpdateForm = new BulkUpdatePage(this);
    this.webhookForm = new WebhookFormPage(this);
    this.findRowByScanOverlay = new FindRowByScanOverlay(this);
    this.childList = new ChildList(this);
    this.linkRecord = new LinkRecord(this);
    this.settings = new SettingsPage(this);
    this.viewSidebar = new ViewSidebarPage(this);
    this.leftSidebar = new LeftSidebarPage(this);
    this.baseView = new ProjectViewPage(this);
    this.importAirtable = new ImportAirtablePage(this);
    this.sidebar = new SidebarPage(this);
    this.docs = new DocsPageGroup(this);
    this.shareProjectButton = new ShareProjectButtonPage(this);
    this.details = new DetailsPage(this);
    this.workspaceSettings = new WorkspaceSettingsObject(this);
    this.cmdJ = new CmdJ(this);
    this.cmdK = new CmdK(this);
    this.cmdL = new CmdL(this);
  }

  get() {
    return this.rootPage.locator('html');
  }

  async goto() {
    await this.rootPage.goto(`/#/${this.base.fk_workspace_id}/${this.base.id}`);
  }

  getProjectMenuLink({ title }: { title: string }) {
    return this.rootPage.locator(`div.nc-base-menu-item:has-text("${title}")`);
  }

  async verifyTeamAndSettingsLinkIsVisible() {
    await this.baseMenuLink.click();
    const teamAndSettingsLink = this.getProjectMenuLink({ title: ' Team & Settings' });
    await expect(teamAndSettingsLink).toBeVisible();
    await this.baseMenuLink.click();
  }

  async verifyTeamAndSettingsLinkIsNotVisible() {
    await this.baseMenuLink.click();
    const teamAndSettingsLink = this.getProjectMenuLink({ title: ' Team & Settings' });
    await expect(teamAndSettingsLink).not.toBeVisible();
    await this.baseMenuLink.click();
  }

  async gotoSettings() {
    await this.baseMenuLink.click();
    await this.rootPage.locator('.ant-dropdown').locator(`.nc-menu-item:has-text("Settings")`).click();
  }

  async gotoProjectSubMenu({ title }: { title: string }) {
    await this.baseMenuLink.click();
    await this.rootPage.locator(`div.nc-base-menu-item:has-text("${title}")`).click();
  }

  async verifyInTabBar({ title }: { title: string }) {
    await this.tabBar.textContent().then(text => expect(text).toContain(title));
  }

  async closeTab({ title }: { title: string }) {}

  async clickHome() {
    await this.leftSidebar.clickHome();
    // wait for workspace page to render
    const workspacePage = new WorkspacePage(this.rootPage);
    await workspacePage.waitFor({ state: 'visible' });
  }

  async verifyOpenedTab({ title, mode = 'standard', emoji }: { title: string; mode?: string; emoji?: string }) {
    await this.tabBar.locator(`.ant-tabs-tab-active:has-text("${title}")`).isVisible();

    if (emoji) {
      await expect(
        this.tabBar.locator(`.ant-tabs-tab-active:has-text("${title}")`).getByTestId(`nc-tab-icon-emojione:${emoji}`)
      ).toBeVisible();
    }
  }

  async verifyTabIsNotOpened({ title }: { title: string }) {
    await expect(this.tabBar.locator(`.ant-tabs-tab:has-text("${title}")`)).not.toBeVisible();
  }

  private async _waitForDocsTabRender({ title, mode }: { title: string; mode: string }) {
    await this.tabBar.locator(`.ant-tabs-tab-active:has-text("${title}")`).waitFor();

    // wait active tab animation to finish
    await expect
      .poll(async () => {
        return await this.tabBar.getByTestId(`nc-root-tabs-${title}`).evaluate(el => {
          return window.getComputedStyle(el).getPropertyValue('color');
        });
      })
      .toBe('rgb(67, 81, 232)');

    await this.rootPage.waitForTimeout(500);
  }

  // When a tab is opened, it is not always immediately visible.
  // Hence will wait till contents are visible
  async waitForTabRender({
    title,
    mode = 'standard',
    type = ProjectTypes.DATABASE,
  }: {
    title: string;
    mode?: string;
    type?: ProjectTypes;
  }) {}

  async toggleMobileMode() {
    await this.baseMenuLink.click();
    const projMenu = this.rootPage.locator('.nc-dropdown-base-menu');
    await projMenu.locator('[data-menu-id="mobile-mode"]:visible').click();
    await this.baseMenuLink.click();
  }

  async signOut() {
    await this.sidebar.userMenu.click();

    await this.rootPage.waitForTimeout(1000);
    await this.rootPage.getByTestId('nc-sidebar-user-logout').waitFor({ state: 'visible' });
    await this.sidebar.userMenu.clickLogout();
    await this.rootPage.waitForTimeout(1000);

    await this.rootPage.locator('[data-testid="nc-form-signin"]:visible').waitFor();
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  async validateProjectMenu(param: { role: string; mode?: string }) {
    await this.rootPage.locator('[data-testid="nc-base-menu"]').click();
    const pMenu = this.rootPage.locator(`.nc-dropdown-base-menu:visible`);

    // menu items
    let menuItems = {
      creator: [
        'Copy Base Info',
        'Swagger: REST APIs',
        'Copy Auth Token',
        'Team & Settings',
        'Themes',
        'Preview as',
        'Language',
        'Account',
      ],
      editor: ['Copy Base Info', 'Swagger: REST APIs', 'Copy Auth Token', 'Language', 'Account'],
      commenter: ['Copy Base Info', 'Copy Auth Token', 'Language', 'Account'],
      viewer: ['Copy Base Info', 'Copy Auth Token', 'Language', 'Account'],
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
    await this.rootPage.locator('[data-testid="nc-base-menu"]').click();
  }

  // Wait for the loader i.e the loader than appears when rows are being fetched, saved etc on the top right of dashboard
  async waitForLoaderToDisappear() {
    await this.rootPage.locator('[data-testid="nc-loading"]').waitFor({ state: 'hidden' });
  }

  /*  async closeAllTabs() {
    await this.tabBar.locator(`.ant-tabs-tab`).waitFor({ state: 'visible' });
    const tab = await this.tabBar.locator(`.ant-tabs-tab`);
    const tabCount = await tab.count();

    for (let i = 0; i < tabCount; i++) {
      await tab.nth(i).locator('button.ant-tabs-tab-remove').click();
      await tab.nth(i).waitFor({ state: 'detached' });
    }
  }*/

  async closeAllTabs() {
    const tab = this.tabBar.locator(`.ant-tabs-tab`);
    const tabCount = await tab.count();

    for (let i = 0; i < tabCount; i++) {
      await tab.nth(i).locator('button.ant-tabs-tab-remove').click();
      await this.rootPage.waitForTimeout(200);
    }
  }

  async validateWorkspaceMenu(param: { role: string; mode?: string }) {
    await this.grid.workspaceMenu.toggle();
    await this.grid.workspaceMenu.get().waitFor({ state: 'visible' });

    const pMenu = this.grid.workspaceMenu.get();

    // menu items
    let menuItems = {
      creator: ['Collaborators', 'Settings', 'Copy Auth Token', 'Themes', 'Preview as', 'Language', 'Account'],
      editor: ['Collaborators', 'Settings', 'Copy Auth Token', 'Language', 'Account'],
      commenter: ['Collaborators', 'Settings', 'Copy Auth Token', 'Language', 'Account'],
      viewer: ['Collaborators', 'Settings', 'Copy Auth Token', 'Language', 'Account'],
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

    // menuItems.creator is a super set. validate if the corresponding items missing in editor, commenter, viewer are not present
    for (const item of menuItems.creator) {
      if (!menuItems[param.role].includes(item)) {
        await expect(pMenu).not.toContainText(item);
      }
    }

    await this.grid.workspaceMenu.toggle();
  }
}
