import { mainPage } from "../../support/page_objects/mainPage";
import {
  isTestSuiteActive,
  isXcdb,
} from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  function addNewRow(index, cellValue) {
    cy.get(".nc-add-new-row-btn:visible").should("exist");
    cy.get(".nc-add-new-row-btn").click();
    // cy.get("#data-table-form-Title > input").first().type(cellValue);
    cy.get(".nc-expand-col-Title")
      .find(".nc-cell > input")
      .should("exist")
      .first()
      .clear()
      .type(cellValue);

    cy.getActiveDrawer(".nc-drawer-expanded-form")
      .find("button")
      .contains("Save row")
      .should("exist")
      .click();

    cy.toastWait("updated successfully");
    cy.get("body").type("{esc}");
    mainPage.getCell("Title", index).contains(cellValue).should("exist");
  }

  describe(`${apiType.toUpperCase()} api - Table Column`, () => {
    const name = "tablex";
    const colName = "column_name_a";
    const updatedColName = "updated_column_name";
    const randVal = "Test@1234.com";
    const updatedRandVal = "Updated@1234.com";

    // before(() => {
    //     cy.restoreLocalStorage();
    //     cy.createTable(name);
    // })

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    // // delete table
    // after(() => {
    //     cy.deleteTable(name, dbType);
    // });

    it("Create Table Column", () => {
      cy.createTable(name);
      mainPage.addColumn(colName, name);
    });

    // edit the newly created column
    it("Edit table column - change datatype", () => {
      if (!isXcdb()) {
        cy.get(`th:contains(${colName}) .nc-icon.ant-dropdown-trigger`)
          .trigger("mouseover", { force: true })
          .click({ force: true });

        // cy.get(".nc-column-edit").click();
        // cy.get(".nc-column-edit").should("not.be.visible");
        cy.getActiveMenu(".nc-dropdown-column-operations")
          .find(".nc-column-edit")
          .click();

        // fix me! wait till the modal rendering (input highlight) is completed
        // focus shifts back to the input field to select text after the dropdown is rendered
        cy.wait(500);

        // change column type and verify
        // cy.get(".nc-column-type-input").last().click();
        cy.getActiveMenu(".nc-dropdown-edit-column")
          .find(".nc-column-type-input")
          .last()
          .click();
        cy.getActiveSelection(".nc-dropdown-column-type")
          .find(".ant-select-item-option")
          .contains("LongText")
          .click();
        cy.getActiveMenu(".nc-dropdown-edit-column")
          .find(".ant-btn-primary:visible")
          .contains("Save")
          .click();

        cy.toastWait("Column updated");
      }
    });

    // edit the newly created column
    it("Edit table column - rename", () => {
      cy.get(`th:contains(${colName}) .nc-icon.ant-dropdown-trigger`)
        .trigger("mouseover", { force: true })
        .click({ force: true });

      // cy.get(".nc-column-edit").click();
      // cy.get(".nc-column-edit").should("not.be.visible");
      cy.getActiveMenu(".nc-dropdown-column-operations")
        .find(".nc-column-edit")
        .click();

      // rename column and verify
      cy.getActiveMenu(".nc-dropdown-edit-column")
        .find("input.nc-column-name-input", { timeout: 3000 })
        .should("exist")
        .clear()
        .type(updatedColName);
      // cy.get(".ant-btn-primary:visible").contains("Save").click();
      cy.getActiveMenu(".nc-dropdown-edit-column")
        .find(".ant-btn-primary:visible")
        .contains("Save")
        .click();

      cy.toastWait("Column updated");

      cy.get(`th:contains(${colName})`).should("not.exist");
      cy.get(`th:contains(${updatedColName})`).should("exist");
    });

    // delete the newly created column
    it("Delete table column", () => {
      mainPage.deleteColumn(updatedColName);
    });

    it("Add new row", () => {
      addNewRow(1, randVal);
    });

    it("Update row", () => {
      mainPage
        .getRow(1)
        .find(".nc-row-no")
        .should("exist")
        .eq(0)
        .trigger("mouseover", { force: true });
      cy.get(".nc-row-expand").click({ force: true });

      // wait for page render to complete
      cy.get('button:contains("Save row"):visible').should("exist");

      cy.get(".nc-expand-col-Title")
        .find(".nc-cell > input")
        .should("exist")
        .first()
        .clear()
        .type(updatedRandVal);

      cy.getActiveDrawer(".nc-drawer-expanded-form")
        .find("button")
        .contains("Save row")
        .should("exist")
        .click();

      // partial toast message
      cy.toastWait("updated successfully");
      cy.get("body").type("{esc}");

      mainPage.getCell("Title", 1).contains(randVal).should("not.exist");
      mainPage.getCell("Title", 1).contains(updatedRandVal).should("exist");
    });

    it("Delete Row", () => {
      mainPage
        .getCell("Title", 1)
        .contains(updatedRandVal)
        .rightclick({ force: true });

      // delete row
      cy.getActiveMenu(".nc-dropdown-grid-context-menu")
        .find('.ant-dropdown-menu-item:contains("Delete Row")')
        .first()
        .click({ force: true });
      cy.get("td").contains(randVal).should("not.exist");
    });

    it("Select all row check-box validation", () => {
      // add multiple rows
      addNewRow(1, "a1");
      addNewRow(2, "a2");
      addNewRow(3, "a3");
      addNewRow(4, "a4");
      addNewRow(5, "a5");

      cy.get(".nc-no-label")
        .should("exist")
        .eq(0)
        .trigger("mouseover", { force: true });
      cy.get(".ant-checkbox").should("exist").eq(0).click({ force: true });

      // delete selected rows
      mainPage.getCell("Title", 3).rightclick({ force: true });
      cy.getActiveMenu(".nc-dropdown-grid-context-menu")
        .contains("Delete Selected Rows")
        .click({ force: true });

      // verify if everything is wiped off
      mainPage.getCell("Title", 1).contains("a1").should("not.exist");

      // clean-up
      cy.deleteTable(name, dbType);
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
