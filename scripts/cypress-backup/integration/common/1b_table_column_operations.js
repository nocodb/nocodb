import { mainPage } from "../../support/page_objects/mainPage";
import {
    isTestSuiteActive,
    isXcdb,
} from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    function addNewRow(index, cellValue) {
        cy.get(".nc-add-new-row-btn:visible").should("exist");
        cy.get(".nc-add-new-row-btn").click({ force: true });
        cy.get("#data-table-form-Title > input").first().type(cellValue);
        cy.snipActiveModal("Modal_AddNewRow");
        cy.getActiveModal()
            .find("button")
            .contains("Save row")
            .click({ force: true });

        cy.toastWait("updated successfully");
        mainPage.getCell("Title", index).contains(cellValue).should("exist");
    }

    describe(`${apiType.toUpperCase()} api - Table Column`, () => {
        const name = "tablex";
        const colName = "column_name_a";
        const updatedColName = "updated_column_name";
        const randVal = "Test@1234.com";
        const updatedRandVal = "Updated@1234.com";

        before(() => {
            mainPage.tabReset();
            cy.createTable(name);
        });

        // delete table
        after(() => {
            cy.deleteTable(name, dbType);
        });

        it("Create Table Column", () => {
            cy.get(`.project-tab:contains(${name}):visible`).should("exist");
            mainPage.addColumn(colName, name);

            cy.get(`th:contains(${colName})`).should("exist");
        });

        // edit the newly created column
        it("Edit table column - change datatype", () => {
            if (!isXcdb()) {
                cy.get(`th:contains(${colName}) .mdi-menu-down`)
                    .trigger("mouseover", { force: true })
                    .click({ force: true });

                cy.get(".nc-column-edit").click();

                // change column type and verify
                cy.get(".nc-ui-dt-dropdown").click();
                cy.contains("LongText").click();
                cy.get(".nc-col-create-or-edit-card").contains("Save").click();

                cy.toastWait("Update table successful");

                cy.get(`th[data-col="${colName}"] .mdi-text-subject`).should(
                    "exist"
                );

                cy.get(`th:contains(${colName}) .mdi-menu-down`)
                    .trigger("mouseover", { force: true })
                    .click({ force: true });

                cy.get(".nc-column-edit").click();
            }
        });

        // edit the newly created column
        it("Edit table column - rename", () => {
            cy.get(`th:contains(${colName}) .mdi-menu-down`)
                .trigger("mouseover", { force: true })
                .click({ force: true });

            cy.get(".nc-column-edit").click();

            // rename column and verify
            cy.get(".nc-column-name-input input").clear().type(updatedColName);
            cy.get(".nc-col-create-or-edit-card").contains("Save").click();

            cy.toastWait("Update table successful");

            cy.get(`th:contains(${colName})`).should("not.exist");
            cy.get(`th:contains(${updatedColName})`).should("exist");
        });

        // delete the newly created column
        it("Delete table column", () => {
            cy.get(`th:contains(${updatedColName})`).should("exist");

            cy.get(`th:contains(${updatedColName}) .mdi-menu-down`)
                .trigger("mouseover")
                .click();

            cy.get(".nc-column-delete").click();
            cy.get("button:contains(Confirm)").click();
            cy.toastWait("Update table successful");

            cy.get(`th:contains(${updatedColName})`).should("not.exist");
        });

        it("Add new row", () => {
            addNewRow(1, randVal);
        });

        it("Update row", () => {
            mainPage
                .getRow(1)
                .find(".nc-row-expand-icon")
                .click({ force: true });
            cy.get("#data-table-form-Title > input")
                .first()
                .clear()
                .type(updatedRandVal);
            cy.getActiveModal()
                .find("button")
                .contains("Save row")
                .click({ force: true });

            cy.toastWait("updated successfully");

            mainPage.getCell("Title", 1).contains(randVal).should("not.exist");
            mainPage
                .getCell("Title", 1)
                .contains(updatedRandVal)
                .should("exist");
        });

        it("Delete row", () => {
            mainPage
                .getCell("Title", 1)
                .contains(updatedRandVal)
                .rightclick({ force: true });

            // delete row
            cy.getActiveMenu()
                .find('.v-list-item:contains("Delete Row")')
                .first()
                .click({ force: true });
            // cy.toastWait('Deleted row successfully')
            cy.get("td").contains(randVal).should("not.exist");
        });

        it("Select all row check-box validation", () => {
            // add multiple rows
            addNewRow(1, "a1");
            addNewRow(2, "a2");
            addNewRow(3, "a3");
            addNewRow(4, "a4");
            addNewRow(5, "a5");

            // check-box, select-all. 0 indicates table header
            mainPage
                .getRow(0)
                .find(".mdi-checkbox-blank-outline")
                .click({ force: true });

            // delete selected rows
            mainPage.getCell("Title", 1).rightclick({ force: true });
            cy.getActiveMenu()
                .contains("Delete Selected Row")
                .click({ force: true });

            // verify if everything is wiped off
            mainPage.getCell("Title", 1).contains("a1").should("not.exist");
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
