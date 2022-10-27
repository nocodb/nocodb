// playwright-dev-page.ts
import { Locator, Page, expect } from "@playwright/test";
import BasePage from "../Base";
import { GridPage } from "./Grid";
import { FormPage } from "./Form";
import { ExpandedFormPage } from "./ExpandedForm";
import { ChildList } from "./Grid/Column/LTAR/ChildList";
import { LinkRecord } from "./Grid/Column/LTAR/LinkRecord";
import { TreeViewPage } from "./TreeView";
import { SettingsPage } from "./Settings";
import { ViewSidebarPage } from "./ViewSidebar";
import { GalleryPage } from "./Gallery";
import { KanbanPage } from "./Kanban";
import { ToolbarPage } from "./common/Toolbar";
import { ImportAirtablePage } from "./Import/Airtable";
import { ImportTemplatePage } from "./Import/ImportTemplate";
import { WebhookFormPage } from "./WebhookForm";

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
    this.tablesSideBar = rootPage.locator(".nc-treeview-container");
    this.tabBar = rootPage.locator(".nc-tab-bar");
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
    return this.rootPage.locator("html");
  }

  async goto() {
    await this.rootPage.goto(`/#/nc/${this.project.id}/auth`);
  }

  async gotoSettings() {
    await this.rootPage.locator('[pw-data="nc-project-menu"]').click();
    await this.rootPage
      .locator('div.nc-project-menu-item:has-text(" Team & Settings")')
      .click();
  }

  async verifyInTabBar({ title }: { title: string }) {
    await this.tabBar
      .textContent()
      .then((text) => expect(text).toContain(title));
  }

  async closeTab({ title }: { title: string }) {
    let tab = await this.tabBar.locator(`.ant-tabs-tab:has-text("${title}")`);
    await tab.locator("button.ant-tabs-tab-remove").click();

    // fix me!
    // await tab.waitFor({ state: "detached" });
    await this.rootPage.waitForTimeout(2000);
  }

  async clickHome() {
    await this.rootPage.locator('[data-cy="nc-noco-brand-icon"]').click();
  }

  async waitForTabRender({
    title,
    mode = "standard",
  }: {
    title: string;
    mode?: string;
  }) {
    await this.get().locator('[pw-data="grid-id-column"]').waitFor();

    await this.tabBar
      .locator(`.ant-tabs-tab-active:has-text("${title}")`)
      .waitFor();

    // wait active tab animation to finish
    await expect
      .poll(async () => {
        return await this.tabBar
          .locator(`[data-pw="nc-root-tabs-${title}"]`)
          .evaluate((el) => {
            return window.getComputedStyle(el).getPropertyValue("color");
          });
      })
      .toBe("rgb(67, 81, 232)"); // active tab text color

    await this.get()
      .locator('[pw-data="grid-load-spinner"]')
      .waitFor({ state: "hidden" });

    if (mode === "standard") {
      await expect(this.rootPage).toHaveURL(
        `/#/nc/${this.project.id}/table/${title}`
      );
    }
  }

  // Project page language menu
  async openLanguageMenu() {
    await this.rootPage.locator(".nc-menu-translate").click();
  }

  async openPasswordChangeModal() {
    // open change password portal
    await this.rootPage.locator(".nc-menu-accounts").click();
    await this.rootPage
      .locator(
        `.nc-dropdown-user-accounts-menu >> [data-cy="nc-menu-accounts__user-settings"]`
      )
      .click();
  }

  async changePassword({
    oldPass,
    newPass,
    repeatPass,
  }: {
    oldPass: string;
    newPass: string;
    repeatPass: string;
  }) {
    // change password
    const currentPassword = await this.rootPage.locator(
      'input[data-cy="nc-user-settings-form__current-password"]'
    );
    const newPassword = await this.rootPage.locator(
      'input[data-cy="nc-user-settings-form__new-password"]'
    );
    const confirmPassword = await this.rootPage.locator(
      'input[data-cy="nc-user-settings-form__new-password-repeat"]'
    );

    await currentPassword.fill(oldPass);
    await newPassword.fill(newPass);
    await confirmPassword.fill(repeatPass);

    await this.rootPage
      .locator('button[data-cy="nc-user-settings-form__submit"]')
      .click();
  }

  async selectLanguage({ index }: { index: number }) {
    let modal = await this.rootPage.locator(".nc-dropdown-menu-translate");
    await modal.locator(`.ant-dropdown-menu-item`).nth(index).click();

    // fix me!
    // allow time for language to change
    await this.rootPage.waitForTimeout(1000);
  }

  async verifyLanguage(param: { json: any }) {
    let title = await this.rootPage
      .locator(`.nc-project-page-title`)
      .textContent();
    let menu = await this.rootPage
      .locator(`.nc-new-project-menu`)
      .textContent();
    expect(title).toContain(param.json.title.myProject);
    expect(menu).toContain(param.json.title.newProj);
    await this.rootPage
      .locator(`[placeholder="${param.json.activity.searchProject}"]`)
      .waitFor();
  }

  // create project
  async createProject({
    name = "sample",
    type = "xcdb",
  }: {
    name?: string;
    type?: string;
  }) {
    // fix me! wait for page to be rendered completely
    await this.rootPage.waitForTimeout(1000);
    await this.rootPage.locator(".nc-new-project-menu").click();

    const createProjectMenu = await this.rootPage.locator(
      ".nc-dropdown-create-project"
    );
    if (type === "xcdb") {
      await createProjectMenu
        .locator(`.ant-dropdown-menu-title-content`)
        .nth(0)
        .click();
    } else {
      await createProjectMenu
        .locator(`.ant-dropdown-menu-title-content`)
        .nth(1)
        .click();
    }

    await this.rootPage.locator(`.nc-metadb-project-name`).waitFor();
    await this.rootPage.locator(`input.nc-metadb-project-name`).fill(name);
    await this.rootPage.locator(`input.nc-metadb-project-name`).press("Enter");

    // fix me! wait for page to be rendered completely
    await this.rootPage.waitForTimeout(2000);
  }

  async signOut() {
    await this.rootPage.locator('[pw-data="nc-project-menu"]').click();
    let projMenu = await this.rootPage.locator(".nc-dropdown-project-menu");
    await projMenu.locator('[data-menu-id="account"]:visible').click();
    await this.rootPage
      .locator('div.nc-project-menu-item:has-text("Sign Out"):visible')
      .click();
    await this.rootPage.locator('[data-cy="nc-form-signin"]:visible').waitFor();
  }

  async signUp({ email, password }: { email: string; password: string }) {
    const signUp = this.rootPage;
    await signUp.locator('button:has-text("SIGN UP")').waitFor();

    await signUp
      .locator(`input[placeholder="Enter your work email"]`)
      .fill(email);
    await signUp
      .locator(`input[placeholder="Enter your password"]`)
      .fill(password);
    await signUp.locator(`button:has-text("SIGN UP")`).click();
  }

  async openProject({ title }: { title?: string }) {
    const project = this.rootPage;
    await project.locator(`td.ant-table-cell:has-text("${title}")`).click();
  }

  async renameProject({
    title,
    newTitle,
  }: {
    title?: string;
    newTitle?: string;
  }) {
    const project = this.rootPage;
    const projRow = await project.locator(`tr`, {
      has: project.locator(`td.ant-table-cell:has-text("${title}")`),
    });
    await projRow.locator(".nc-action-btn").nth(0).click();
    await project.locator("input.nc-metadb-project-name").fill(newTitle);
    // press enter to save
    await project.locator("input.nc-metadb-project-name").press("Enter");
  }

  async deleteProject({ title }: { title?: string }) {
    const project = this.rootPage;
    const projRow = await project.locator(`tr`, {
      has: project.locator(`td.ant-table-cell:has-text("${title}")`),
    });
    await projRow.locator(".nc-action-btn").nth(1).click();
    const deleteModal = await project.locator(".nc-modal-project-delete");
    await deleteModal.locator('button:has-text("Yes")').click();

    await this.rootPage.waitForTimeout(1000);

    expect(
      await project.locator(`td.ant-table-cell:has-text("${title}")`).count()
    ).toBe(0);
  }

  async validateProjectMenu(param: { role: string; mode?: string }) {
    await this.rootPage.locator('[pw-data="nc-project-menu"]').click();
    let pMenu = this.rootPage.locator(`.nc-dropdown-project-menu:visible`);

    // menu items
    let menuItems = {
      creator: [
        "Copy Project Info",
        "Swagger: REST APIs",
        "Copy Auth Token",
        "Team & Settings",
        "Themes",
        "Preview as",
        "Language",
        "Account",
      ],
      editor: [
        "Copy Project Info",
        "Swagger: REST APIs",
        "Copy Auth Token",
        "Language",
        "Account",
      ],
      commenter: [
        "Copy Project Info",
        "Copy Auth Token",
        "Language",
        "Account",
      ],
      viewer: ["Copy Project Info", "Copy Auth Token", "Language", "Account"],
    };

    if (param?.mode === "shareBase") {
      menuItems = {
        creator: [],
        commenter: [],
        editor: ["Language"],
        viewer: ["Language"],
      };
    }

    // common items

    for (let item of menuItems[param.role]) {
      await expect(pMenu).toContainText(item);
    }
    await this.rootPage.locator('[pw-data="nc-project-menu"]').click();
  }
}
