import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage, settingsPage } from "../../support/page_objects/mainPage";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${
    dbType === "xcdb" ? "Meta - " : ""
  }${apiType.toUpperCase()} api - Table`, () => {
    // before(() => {
    //     // standalone test
    //     // loginPage.loginAndOpenProject(apiType, dbType);
    //
    //     // open a table to work on views
    //     //
    //     // cy.restoreLocalStorage();
    // });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    // after(() => {
    // });

    const name = "tablex";

    // create a new random table
    it("Create Table", () => {
      cy.createTable(name);
    });

    // delete newly created table
    it("Delete Table", () => {
      cy.deleteTable(name, dbType);
    });

    const getAuditCell = (row, col) => {
      return cy.get("tbody > tr").eq(row).find("td.ant-table-cell").eq(col);
    };

    describe("Check Audit Tab Cells", () => {
      it("Open Audit tab", () => {
        // http://localhost:8080/api/v1/db/meta/projects/p_bxp57hmks0n5o2/audits?offset=0&limit=25
        cy.intercept("/**/audits?offset=*&limit=*").as("waitForPageLoad");

        // mainPage.navigationDraw(mainPage.AUDIT).click();
        settingsPage.openMenu(settingsPage.AUDIT);
        // wait for column headers to appear
        //
        cy.get("thead > tr > th.ant-table-cell").should("have.length", 5);

        cy.wait("@waitForPageLoad");

        // Audit table entries
        //  [Header] Operation Type, Operation Sub Type, Description, User, Created
        //  [0] TABLE, DELETED, delete table table-x, user@nocodb.com, ...
        //  [1] TABLE, Created, created table table-x, user@nocodb.com, ...

        getAuditCell(0, 0).contains("TABLE").should("exist");
        getAuditCell(0, 1).contains("DELETED").should("exist");
        getAuditCell(0, 3).contains("user@nocodb.com").should("exist");

        getAuditCell(1, 0).contains("TABLE").should("exist");
        getAuditCell(1, 1).contains("CREATED").should("exist");
        getAuditCell(1, 3).contains("user@nocodb.com").should("exist");
      });

      after(() => {
        settingsPage.closeMenu();
      })
    })

    it("Table Rename operation", () => {
      cy.get(".nc-project-tree-tbl-City").should("exist").click();

      cy.renameTable("City", "CityX");

      // verify
      // 1. Table name in project tree has changed
      // cy.get(".nc-tbl-title").contains("CityX").should("exist");
      cy.get(".nc-project-tree-tbl-CityX").should("exist");

      // 2. Table tab name has changed
      cy.get(`.ant-tabs-tab:contains('CityX'):visible`).should("exist");

      // Wait for Grid to render
      cy.gridWait(25);

      // 3. contents of the table are valid
      mainPage
        .getCell(`City`, 1)
        .contains("A Corua (La Corua)")
        .should("exist");

      cy.closeTableTab("CityX");

      // revert re-name operation to not impact rest of test suite
      cy.renameTable("CityX", "City");
    });
  });
};