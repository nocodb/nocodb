import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";
import { ToolbarPage } from "../pages/Dashboard/common/Toolbar";
import {
  SettingsPage,
  SettingsSubTab,
  SettingTab,
} from "../pages/Dashboard/Settings";

let roles = ["Editor", "Commenter", "Viewer"];

test.describe.skip("Preview Mode", () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let settings: SettingsPage;

  let context: any;

  test.beforeAll(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;
    settings = dashboard.settings;
  });

  test("Test case name", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });

    // configure ACL
    // configure access control
    await dashboard.gotoSettings();
    await settings.selectTab({
      tab: SettingTab.ProjectMetadata,
      subTab: SettingsSubTab.ACL,
    });
    await settings.acl.toggle({ table: "Language", role: "editor" });
    await settings.acl.toggle({ table: "Language", role: "commenter" });
    await settings.acl.toggle({ table: "Language", role: "viewer" });
    await settings.acl.toggle({ table: "CustomerList", role: "editor" });
    await settings.acl.toggle({ table: "CustomerList", role: "commenter" });
    await settings.acl.toggle({ table: "CustomerList", role: "viewer" });
    await settings.acl.save();
    await settings.close();

    // await dashboard.grid.projectMenu.toggle();
    // await dashboard.grid.projectMenu.click({
    //   menu: "Preview as",
    //   subMenu: "Editor",
    // });
    //
    // // wait for preview mode to be enabled
    // await dashboard.rootPage.locator(".nc-preview-btn-exit-to-app").waitFor();
  });

  async function roleTest(role: string) {
    await dashboard.grid.projectMenu.toggle();
    await dashboard.grid.projectMenu.click({
      menu: "Preview as",
      subMenu: role,
    });

    // wait for preview mode to be enabled
    await dashboard.rootPage.locator(".nc-preview-btn-exit-to-app").waitFor();

    console.log("project menu");
    await dashboard.validateProjectMenu({
      role: role.toLowerCase(),
    });

    await dashboard.treeView.openTable({ title: "Country" });

    console.log("view sidebar");
    await dashboard.viewSidebar.validateRoleAccess({
      role: role.toLowerCase(),
    });

    console.log("toolbar");
    await toolbar.validateRoleAccess({
      role: role.toLowerCase(),
    });

    console.log("tree view");
    await dashboard.treeView.validateRoleAccess({
      role: role.toLowerCase(),
    });

    console.log("grid");
    await dashboard.grid.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await dashboard.grid.openExpandedRow({ index: 0 });
    console.log("expanded row");
    await dashboard.expandedForm.validateRoleAccess({
      role: role.toLowerCase(),
    });

    // Access control validation
    console.log("access control");
    await dashboard.treeView.verifyTable({
      title: "Language",
      exists: role.toLowerCase() === "creator" ? true : false,
    });
    await dashboard.treeView.verifyTable({
      title: "CustomerList",
      exists: role.toLowerCase() === "creator" ? true : false,
    });

    // close preview mode
    await dashboard.rootPage.locator(".nc-preview-btn-exit-to-app").click();
  }

  test("Role Test", async () => {
    for (let i = 0; i < roles.length; i++) {
      console.log("Role: ", roles[i]);
      await roleTest(roles[i]);
    }
  });
});
