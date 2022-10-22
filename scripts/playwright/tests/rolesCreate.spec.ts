import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";
import { ToolbarPage } from "../pages/Dashboard/common/Toolbar";
import {
  SettingsPage,
  SettingsSubTab,
  SettingTab,
} from "../pages/Dashboard/Settings";

let roleDb = [
  { email: "creator@nocodb.com", role: "creator", url: "" },
  { email: "editor@nocodb.com", role: "editor", url: "" },
  { email: "commenter@nocodb.com", role: "commenter", url: "" },
  { email: "viewer@nocodb.com", role: "viewer", url: "" },
];

async function roleSignup(roleIdx: number, db: any) {
  console.log(roleDb[roleIdx].url);
  await db.signOut();

  await db.rootPage.goto(roleDb[roleIdx].url);
  await db.signUp({
    email: roleDb[roleIdx].email,
    password: "Password123.",
  });

  await db.openProject({ title: "externalREST0" });

  // close 'Team & Auth' tab
  if (roleDb[roleIdx].role === "creator") {
    await db.closeTab({ title: "Team & Auth" });
  }
}

test.describe("User roles", () => {
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

  test("Create role", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.gotoSettings();
    await settings.selectTab({ tab: SettingTab.TeamAuth });
    for (let i = 0; i < roleDb.length; i++) {
      roleDb[i].url = await settings.teams.invite({
        email: roleDb[i].email,
        role: roleDb[i].role,
      });
      await settings.teams.closeInvite();
    }
    await settings.close();

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
  });

  async function roleTest(roleIdx: number, db: any) {
    await roleSignup(roleIdx, dashboard);
    await dashboard.validateProjectMenu({
      role: roleDb[roleIdx].role,
    });

    await dashboard.treeView.openTable({ title: "Country" });

    await dashboard.viewSidebar.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await toolbar.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.treeView.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.grid.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    // Access control validation
    await dashboard.treeView.verifyTable({
      title: "Language",
      exists: roleDb[roleIdx].role === "creator" ? true : false,
    });
    await dashboard.treeView.verifyTable({
      title: "CustomerList",
      exists: roleDb[roleIdx].role === "creator" ? true : false,
    });
  }

  test("Role Test", async () => {
    for (let i = 0; i < roleDb.length; i++) {
      await roleTest(i, dashboard);
    }
  });
});
