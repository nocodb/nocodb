
import { expect, test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import { LoginPage } from "../pages/LoginPage";
import { ProjectsPage } from "../pages/ProjectsPage";

// normal fields
let recordCells = {
  Name: "Movie-1",
  Notes: "Good",
  Status: "Todo",
  Tags: "Jan",
  Phone: "123123123",
  Email: "a@b.com",
  URL: "www.a.com",
  Number: "1",
  Value: "$1.00",
  Percent: "0.01",
};

// links/ computed fields
let recordsVirtualCells = {
  Duration: "00:01",
  Done: true,
  Date: "2022-05-31",
  Rating: 1,
  Actor: ["Actor1", "Actor2"],
  "Status (from Actor)": ["Todo", "In progress"],
  RollUp: "128",
  Computation: "4.04",
  Producer: ["P1", "P2"],
};

let tn = ["Film", "Actor", "Producer"];

let cn = [
  "Name",
  "Notes",
  "Status",
  "Tags",
  "Done",
  "Date",
  "Phone",
  "Email",
  "URL",
  "Number",
  "Percent",
  "Duration",
  "Rating",
  "Actor",
  "Status (from Actor)",
  "RollUp",
  "Computation",
  "Producer",
];

test.describe("Quick tests", () => {
  let dashboard: DashboardPage;

  // test.beforeEach(async ({ page }) => {
  // });

  test("Quick tests test", async ({page}) => {
    let cellIndex = 0;
    let columnCount = cn.length;

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillEmail("user@nocodb.com");
    await loginPage.fillPassword("Password123.");
    await loginPage.submit();

    const projectsPage = new ProjectsPage(page);
    const project = await projectsPage.selectAndGetProject("sample");
    dashboard = new DashboardPage(page, project);

    // verify if all tables exist
    for (let i = 0; i < tn.length; i++) {
      await dashboard.treeView.verifyTable({ title: tn[i] });
    }

    await dashboard.treeView.openTable({ title: "Film" });
    // for Film table, verify columns
    for (let i = 0; i < columnCount; i++) {
      await dashboard.grid.column.verify({ title: cn[i] });
    }

    // normal cells
    for (let [key, value] of Object.entries(recordCells)) {
      await dashboard.grid.cell.verify({ index: cellIndex, columnHeader: key, value });
    }

    // checkbox
    await dashboard.grid.cell.checkbox.verifyChecked({ index: cellIndex, columnHeader: "Done" });

    // duration
    await dashboard.grid.cell.verify({ index: cellIndex, columnHeader: "Duration", value: recordsVirtualCells.Duration });

    // rating
    await dashboard.grid.cell.rating.verify({ index: cellIndex, columnHeader: "Rating", rating: recordsVirtualCells.Rating });

    // LinkToAnotherRecord
    await dashboard.grid.cell.verifyVirtualCell({ index: cellIndex, columnHeader: "Actor", value: recordsVirtualCells.Actor });

    // Status (from Actor)
    // todo: Find a way to verify only the elements that are passed in
    // await dashboard.grid.cell.verify({ index: cellIndex, columnHeader: "Status (from Actor)", value: recordsVirtualCells["Status (from Actor)"][0] });

    // RollUp
    await dashboard.grid.cell.verify({ index: cellIndex, columnHeader: "RollUp", value: recordsVirtualCells.RollUp });

    // Computation
    await dashboard.grid.cell.verify({ index: cellIndex, columnHeader: "Computation", value: recordsVirtualCells.Computation });

    // LinkToAnotherRecord
    await dashboard.grid.cell.verifyVirtualCell({ index: cellIndex, columnHeader: "Producer", value: recordsVirtualCells.Producer });


    // Verify form
    await dashboard.viewSidebar.openView({ title: "FormTitle" });
    await dashboard.form.verifyHeader({ title: "FormTitle", subtitle: "FormDescription" });
    await dashboard.form.verifyFormFieldLabel({ index: 0, label: "DisplayName" });
    await dashboard.form.verifyFormFieldHelpText({ index: 0, helpText: "HelpText" });
    await dashboard.form.verifyFieldsIsEditable({ index: 0 });
    await dashboard.form.verifyAfterSubmitMsg({ msg: "Thank you for submitting the form!" });
    await dashboard.form.verifyAfterSubmitMenuState({
      emailMe: false,
      showBlankForm: true,
      submitAnotherForm: true,
    });

    // Verify webhooks
    await dashboard.treeView.openTable({ title: "Actor" });
    // await dashboard.webhookForm.open({})
  });
});
