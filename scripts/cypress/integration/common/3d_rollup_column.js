import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - RollUp column`, () => {
        // to retrieve few v-input nodes from their label
        //
        const fetchParentFromLabel = (label) => {
            cy.get("label").contains(label).parents(".v-input").click();
        };

        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            mainPage.tabReset();
            // open a table to work on views
            //
            cy.openTableTab("Country", 25);
        });

        after(() => {
            cy.closeTableTab("Country");
        });

        // Routine to create a new look up column
        //
        const addLookUpColumn = (
            columnName,
            childTable,
            childCol,
            aggregateFunc
        ) => {
            // (+) icon at end of column header (to add a new column)
            // opens up a pop up window
            //
            cy.get(".new-column-header").click();

            // Column name
            cy.get(".nc-column-name-input input").clear().type(`${columnName}`);

            // Column data type: to be set to rollup in this context
            // Type 'Rollup' ensures item outside view is also listed (note, rollup is at bottom of scroll list)
            cy.get(".nc-ui-dt-dropdown").click().type("Rollup");
            cy.getActiveMenu().contains("Rollup").click({ force: true });

            // Configure Child table & column names
            fetchParentFromLabel("Child table");
            cy.getActiveMenu().contains(childTable).click();

            fetchParentFromLabel("Child column");
            cy.getActiveMenu().contains(childCol).click();

            fetchParentFromLabel("Aggregate function");
            cy.getActiveMenu().contains(aggregateFunc).click();

            cy.snipActiveMenu("RollUp");

            // click on Save
            cy.get(".nc-col-create-or-edit-card").contains("Save").click();

            // Verify if column exists.
            //
            cy.get(`th:contains(${columnName})`).should("exist");
        };

        // routine to delete column
        //
        const deleteColumnByName = (columnName) => {
            // verify if column exists before delete
            cy.get(`th:contains(${columnName})`).should("exist");

            // delete opiton visible on mouse-over
            cy.get(`th:contains(${columnName}) .mdi-menu-down`)
                .trigger("mouseover")
                .click();

            // delete/ confirm on pop-up
            cy.get(".nc-column-delete").click();
            cy.getActiveModal().find("button:contains(Confirm)").click();

            // validate if deleted (column shouldnt exist)
            cy.get(`th:contains(${columnName})`).should("not.exist");
        };

        // routine to edit column
        //
        const editColumnByName = (oldName, newName) => {
            // verify if column exists before delete
            cy.get(`th:contains(${oldName})`).should("exist");

            // delete opiton visible on mouse-over
            cy.get(`th:contains(${oldName}) .mdi-menu-down`)
                .trigger("mouseover")
                .click();

            // edit/ save on pop-up
            cy.get(".nc-column-edit").click();
            cy.get(".nc-column-name-input input").clear().type(newName);
            cy.get(".nc-col-create-or-edit-card").contains("Save").click();

            cy.toastWait("Successfully updated alias");

            // validate if deleted (column shouldnt exist)
            cy.get(`th:contains(${oldName})`).should("not.exist");
            cy.get(`th:contains(${newName})`).should("exist");
        };

        ///////////////////////////////////////////////////
        // Test case

        it("Add Rollup column (City, City, count) & Delete", () => {
            addLookUpColumn("RollUpCol_2", "City", "City", "count");

            // Verify first entry, will be displayed as alias here 'childColumn (from childTable)'
            // intentionally verifying 4th item, as initial items are being masked out by list scroll down
            // to be fixed
            //
            cy.get(`tbody > :nth-child(4) > [data-col="RollUpCol_2"]`)
                .contains("2")
                .should("exist");

            editColumnByName("RollUpCol_2", "RollUpCol_New");
            deleteColumnByName("RollUpCol_New");
        });

        it.skip("Add Rollup column (City, CountryId, count) & Delete", () => {
            addLookUpColumn("RollUpCol_1", "City", "CountryId", "count");

            // Verify first entry, will be displayed as alias here 'childColumn (from childTable)'
            cy.get(`tbody > :nth-child(4) > [data-col="RollUpCol_1"]`)
                .contains("2")
                .should("exist");

            editColumnByName("RollUpCol_1", "RollUpCol_New");
            deleteColumnByName("RollUpCol_New");
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
