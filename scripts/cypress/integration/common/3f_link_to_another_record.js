import { mainPage } from "../../support/page_objects/mainPage";
import { loginPage } from "../../support/page_objects/navigation";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  let waitTime = 2000;

  describe(`${apiType.toUpperCase()} api - Link to another record`, () => {
    function fetchParentFromLabel(label) {
      cy.get("label").contains(label).parents(".ant-row").click();
    }

    // Insert new row
    function addRow(index, cellValue) {
      cy.get(".nc-grid-add-new-cell").should("exist").click();
      mainPage
        .getCell("Title", index)
        .dblclick()
        .then(($el) => {
          cy.wrap($el).find("input").clear().type(`${cellValue}{enter}`);
        });
      mainPage.getCell("Title", index).contains(cellValue).should("exist");
    }

    // Insert LTAR column
    //
    function addLtarColumn(columnName, foreignTable, relationType) {
      // + icon
      cy.get(".nc-grid  tr > th:last .nc-icon").click();

      // Column name
      cy.getActiveMenu(".nc-dropdown-grid-add-column")
        .find("input.nc-column-name-input", { timeout: 3000 })
        .should("exist")
        .clear()
        .type(columnName);

      // Column type
      // cy.get(".nc-column-type-input").last()
      //   .click()
      //   .type("Link");
      cy.getActiveMenu(".nc-dropdown-grid-add-column")
        .find(".nc-column-type-input")
        .last()
        .click()
        .type("Link");
      cy.getActiveSelection(".nc-dropdown-column-type")
        .find(".ant-select-item-option")
        .contains("LinkToAnotherRecord")
        .click();

      // relation type (hm/ mm)
      cy.get(".nc-ltar-relation-type")
        .find(".ant-radio")
        .eq(relationType === "hm" ? 0 : 1)
        .click();

      // Foreign table
      fetchParentFromLabel("Child table");
      cy.get(".nc-ltar-child-table").last().click().type(foreignTable);
      cy.getActiveSelection(".nc-dropdown-ltar-child-table")
        .find(".ant-select-item-option")
        .contains(foreignTable)
        .click();

      // Save
      // cy.get(".ant-btn-primary")
      //   .contains("Save")
      //   .should('exist')
      //   .click();
      cy.getActiveMenu(".nc-dropdown-grid-add-column")
        .find(".ant-btn-primary:visible")
        .contains("Save")
        .click();

      // Toast
      cy.toastWait(`Column created`);

      // Verify
      cy.get(`th[data-title="${columnName}"]`).should("exist");
    }

    // Content verification for LTAR cell
    // Validates only 1st chip contents
    //
    function verifyLtarCell(columnName, index, cellValue) {
      cy.get(`:nth-child(${index}) > [data-title="${columnName}"]`)
        .find(".chip")
        .eq(0)
        .contains(cellValue)
        .should("exist");
    }

    // Unlink LTAR cell
    //
    function ltarUnlink(columnName, index) {
      // http://localhost:8080/api/v1/db/meta/audits/comments/count?ids[]=1&fk_model_id=md_f4y7jp89pe8vkt
      cy.intercept("GET", `/api/v1/db/meta/audits/comments/count?**`).as(
        "unlinkCount"
      );

      // Click on cell to enable unlink icon
      cy.get(`:nth-child(${index}) > [data-title="${columnName}"]`)
        .last()
        .click();

      // Click on unlink icon
      cy.get(`:nth-child(${index}) > [data-title="${columnName}"]`)
        .last()
        .find(".unlink-icon")
        .should("exist")
        .click();

      // Glitch; hence wait
      cy.wait("@unlinkCount");
    }

    // before(() => {
    //   // required for standalone test
    //   // loginPage.loginAndOpenProject(apiType, dbType);
    // });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    after(() => {
      // Cleanup
      //
      cy.restoreLocalStorage();

      cy.openTableTab("Sheet1", 0);
      mainPage.deleteColumn("Link1-2hm");
      mainPage.deleteColumn("Link1-2mm");
      mainPage.deleteColumn("Sheet2");
      cy.deleteTable("Sheet1");

      cy.deleteTable("Sheet2");
      cy.saveLocalStorage();
    });

    ///////////////////////////////////////////////////
    // Test case

    it("Create Link columns", () => {
      cy.createTable("Sheet1");
      cy.createTable("Sheet2");

      cy.openTableTab("Sheet1", 0);
      addRow(1, "1a");
      addRow(2, "1b");
      addRow(3, "1c");
      addLtarColumn("Link1-2hm", "Sheet2", "hm");
      addLtarColumn("Link1-2mm", "Sheet2", "mm");
      cy.closeTableTab("Sheet1");

      cy.openTableTab("Sheet2", 0);
      addLtarColumn("Link2-1hm", "Sheet1", "hm");
      cy.closeTableTab("Sheet2");

      // Sheet2 now has all 3 column categories : HM, BT, MM
      //
    });

    // Expand form [Add new row]
    //
    it("Add HM, BT, MM Link, Expand form", () => {
      // http://localhost:8080/api/v1/db/data/noco/p_0l53e1xgsxlecb/md_mn4xgb2jnq16a7?limit=10&offset=0&where=&fields[]=Title&fields[]=Id
      cy.intercept("GET", `/api/v1/db/data/noco/**`).as("waitForCardLoad");

      cy.openTableTab("Sheet2", 0);

      // Click on `Add new row` button
      cy.get(".nc-add-new-row-btn:visible").should("exist");
      cy.get(".nc-add-new-row-btn").click();

      // Title
      cy.get(".nc-expand-col-Title")
        .find(".nc-cell > input")
        .should("exist")
        .first()
        .clear()
        .type("2a");

      // trigger("mouseover") is required to show the + icon
      // didn't seem to work. As a kludge, used click with {force:true}
      // additional delay ensures card contents are available before clicking
      //

      // BT
      cy.get(".nc-expand-col-Sheet1")
        .find(".nc-action-icon")
        .should("exist")
        .click({ force: true });
      // cy.wait(1000);
      cy.wait("@waitForCardLoad");
      cy.getActiveModal(".nc-modal-link-record")
        .find(".ant-card")
        .should("exist")
        .eq(0)
        .click();

      // MM
      cy.get(".nc-expand-col-Sheet1.List").find(".ant-btn-primary").click();
      // cy.wait(1000);
      cy.wait("@waitForCardLoad");
      cy.getActiveModal(".nc-modal-link-record")
        .find(".ant-card")
        .should("exist")
        .eq(0)
        .click();

      // HM
      cy.get(".nc-expand-col-Link2-1hm").find(".ant-btn-primary").click();
      // cy.wait(1000);
      cy.wait("@waitForCardLoad");
      cy.getActiveModal().find(".ant-card").should("exist").eq(0).click();

      // Save row
      cy.getActiveDrawer(".nc-drawer-expanded-form")
        .find("button")
        .contains("Save row")
        .should("exist")
        .click();

      // Toast
      cy.toastWait("updated successfully");

      // Close modal
      cy.get("body").type("{esc}");
    });

    // In cell insert
    it("Add HM, BT, MM Link, In cell form", () => {
      // Insert row with `Title` field, rest of links are empty
      addRow(2, "2b");

      // BT
      mainPage
        .getCell("Sheet1", 2)
        .find(".nc-action-icon")
        .click({ force: true });
      cy.getActiveModal(".nc-modal-link-record")
        .find(".ant-card")
        .should("exist")
        .eq(1)
        .click();
      cy.wait(1000);

      // MM
      mainPage
        .getCell("Sheet1 List", 2)
        .find(".nc-action-icon")
        .last()
        .click({ force: true });
      cy.getActiveModal(".nc-modal-link-record")
        .find(".ant-card")
        .should("exist")
        .eq(1)
        .click();
      cy.wait(1000);

      // HM
      mainPage
        .getCell("Link2-1hm", 2)
        .find(".nc-action-icon")
        .last()
        .click({ force: true });
      cy.getActiveModal(".nc-modal-link-record")
        .find(".ant-card")
        .should("exist")
        .eq(1)
        .click();
    });

    // Existing row, expand record
    it("Add HM, BT, MM Link, expand record", () => {
      // http://localhost:8080/api/v1/db/data/noco/p_0l53e1xgsxlecb/md_mn4xgb2jnq16a7?limit=10&offset=0&where=&fields[]=Title&fields[]=Id
      cy.intercept("GET", `/api/v1/db/data/noco/**`).as("waitForCardLoad");

      addRow(3, "2c");
      cy.get(".nc-row-expand").eq(2).click({ force: true });

      // wait for page render to complete
      cy.get('button:contains("Save row"):visible').should("exist");

      // BT
      cy.wait(1000);
      cy.get(".nc-expand-col-Sheet1")
        .find(".nc-action-icon")
        .should("exist")
        .click({ force: true });
      cy.wait(waitTime);
      // cy.wait("@waitForCardLoad");
      cy.getActiveModal(".nc-modal-link-record")
        .find(".ant-card")
        .should("exist")
        .eq(2)
        .click();

      // MM
      cy.get(".nc-expand-col-Sheet1.List").find(".ant-btn-primary").click();
      cy.wait(waitTime);
      // cy.wait("@waitForCardLoad");
      cy.getActiveModal(".nc-modal-link-record")
        .find(".ant-card")
        .should("exist")
        .eq(2)
        .click();
      cy.wait(1000);

      // HM
      cy.get(".nc-expand-col-Link2-1hm").find(".ant-btn-primary").click();
      cy.wait(waitTime);
      // cy.wait("@waitForCardLoad");
      cy.getActiveModal(".nc-modal-link-record")
        .find(".ant-card")
        .should("exist")
        .eq(2)
        .click();
      cy.wait(1000);

      cy.getActiveDrawer(".nc-drawer-expanded-form")
        .find("button")
        .contains("Save row")
        .should("exist")
        .click();

      // cy.toastWait("updated successfully");
      cy.toastWait("No columns to update");
      cy.get("body").type("{esc}");

      verifyLtarCell("Sheet1", 1, "1a");
      verifyLtarCell("Sheet1", 2, "1b");
      verifyLtarCell("Sheet1", 3, "1c");
      verifyLtarCell("Sheet1 List", 1, "1a");
      verifyLtarCell("Sheet1 List", 2, "1b");
      verifyLtarCell("Sheet1 List", 3, "1c");
      verifyLtarCell("Link2-1hm", 1, "1a");
      verifyLtarCell("Link2-1hm", 2, "1b");
      verifyLtarCell("Link2-1hm", 3, "1c");

      cy.closeTableTab("Sheet2");
    });

    it("Verification", () => {
      cy.openTableTab("Sheet1", 3);
      verifyLtarCell("Link1-2hm", 1, "2a");
      verifyLtarCell("Link1-2hm", 2, "2b");
      verifyLtarCell("Link1-2hm", 3, "2c");
      verifyLtarCell("Link1-2mm", 1, "2a");
      verifyLtarCell("Link1-2mm", 2, "2b");
      verifyLtarCell("Link1-2mm", 3, "2c");
      verifyLtarCell("Sheet2", 1, "2a");
      verifyLtarCell("Sheet2", 2, "2b");
      verifyLtarCell("Sheet2", 3, "2c");
      cy.closeTableTab("Sheet1");
    });

    it("Unlink", () => {
      cy.openTableTab("Sheet1", 3);
      ltarUnlink("Link1-2hm", 1);
      ltarUnlink("Link1-2hm", 2);
      ltarUnlink("Link1-2hm", 3);
      ltarUnlink("Link1-2mm", 1);
      ltarUnlink("Link1-2mm", 2);
      ltarUnlink("Link1-2mm", 3);
      ltarUnlink("Sheet2", 1);
      ltarUnlink("Sheet2", 2);
      ltarUnlink("Sheet2", 3);
      cy.closeTableTab("Sheet1");
    });
  });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Raju Udava <sivadstala@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
