import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";
import { ToolbarPage } from "../pages/Dashboard/common/Toolbar";
import { LoginPage } from "../pages/LoginPage";

test.describe("Shared base", () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let context: any;
  let loginPage: LoginPage;

  async function roleTest(role: string) {
    console.log("project menu");
    await dashboard.validateProjectMenu({
      role: role.toLowerCase(),
      mode: "shareBase",
    });

    await dashboard.treeView.openTable({ title: "Country", mode: "shareBase" });

    console.log("shareBase: view sidebar");
    await dashboard.viewSidebar.validateRoleAccess({
      role: role.toLowerCase(),
    });

    console.log("shareBase: toolbar");
    await toolbar.validateRoleAccess({
      role: role.toLowerCase(),
      mode: "shareBase",
    });

    console.log("shareBase: tree view");
    await dashboard.treeView.validateRoleAccess({
      role: role.toLowerCase(),
    });

    console.log("shareBase: grid");
    await dashboard.grid.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await dashboard.grid.openExpandedRow({ index: 0 });
    console.log("shareBase: expanded row");
    await dashboard.expandedForm.validateRoleAccess({
      role: role.toLowerCase(),
    });
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;
    loginPage = new LoginPage(page);
  });

  test("#1", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });

    await dashboard.treeView.inviteTeamButton.click();
    await dashboard.settings.teams.toggleSharedBase({ toggle: true });
    await dashboard.settings.teams.sharedBaseRole({ role: "editor" });
    let url = await dashboard.settings.teams.getSharedBaseUrl();
    await dashboard.settings.teams.closeInvite();

    // access shared base link
    await dashboard.signOut();
    await dashboard.rootPage.goto(url);

    await roleTest("editor");

    await loginPage.signIn({
      email: "user@nocodb.com",
      password: "Password123.",
    });
    await dashboard.openProject({ title: "externalREST0" });
    await dashboard.closeTab({ title: "Team & Auth" });

    await dashboard.treeView.inviteTeamButton.click();
    await dashboard.settings.teams.toggleSharedBase({ toggle: true });
    await dashboard.settings.teams.sharedBaseRole({ role: "viewer" });
    url = await dashboard.settings.teams.getSharedBaseUrl();
    await dashboard.settings.teams.closeInvite();

    // access shared base link
    await dashboard.signOut();
    await dashboard.rootPage.goto(url);

    await roleTest("viewer");
  });
});
