import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";
import { ToolbarPage } from "../pages/Dashboard/common/Toolbar";
import { LoginPage } from "../pages/LoginPage";

test.describe("Auth", () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;
  });

  test.skip("Change password", async ({ page }) => {
    await dashboard.clickHome();
    await dashboard.openPasswordChangeModal();

    // Existing active pass incorrect
    await dashboard.changePassword({
      oldPass: "123456789",
      newPass: "123456789",
      repeatPass: "123456789",
    });
    await dashboard.rootPage
      .locator(
        '[data-cy="nc-user-settings-form__error"]:has-text("Current password is wrong")'
      )
      .waitFor();

    // New pass and repeat pass mismatch
    await dashboard.changePassword({
      oldPass: "Password123.",
      newPass: "123456789",
      repeatPass: "987654321",
    });
    await dashboard.rootPage
      .locator(
        '.ant-form-item-explain-error:has-text("Passwords do not match")'
      )
      .waitFor();

    // All good
    await dashboard.changePassword({
      oldPass: "Password123.",
      newPass: "NewPasswordConfigured",
      repeatPass: "NewPasswordConfigured",
    });

    const loginPage = new LoginPage(page);
    await loginPage.fillEmail("user@nocodb.com");
    await loginPage.fillPassword("NewPasswordConfigured");
    await loginPage.submit();

    await page
      .locator('.nc-project-page-title:has-text("My Projects")')
      .waitFor();
  });
});
