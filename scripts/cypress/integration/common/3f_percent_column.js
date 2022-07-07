import { mainPage } from "../../support/page_objects/mainPage";
import {
    isTestSuiteActive,
} from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - PERCENT`, () => {
        const tableName = "PercentTable";

        // to retrieve few v-input nodes from their label
        //
        const fetchParentFromLabel = (label) => {
            cy.get("label").contains(label).parents(".v-input").click();
        };

        // Run once before test- create table
        //
        before(() => {
            mainPage.tabReset();
            cy.createTable(tableName);
        });

        after(() => {
            cy.deleteTable(tableName);
        });

        // Routine to create a new percent column
        //
        const addPercentColumn = (columnName, precision, defaultNumber, negative) => {
            // (+) icon at end of column header (to add a new column)
            // opens up a pop up window
            //
            cy.get(".new-column-header").click();

            // Column name
            cy.get(".nc-column-name-input input").clear().type(`${columnName}`);

            // Column data type
            cy.get(".nc-ui-dt-dropdown").click();
            cy.getActiveMenu().contains("Percent").click();

            // Configure Precision
            fetchParentFromLabel("Precision");
            cy.getActiveMenu().contains(precision).click();

            // Configure Default Number
            fetchParentFromLabel("Default Number (%)");
            if (defaultNumber) {
                cy.getActiveMenu().find('input[type="number"]').type(defaultNumber);
            }

            // Configure Negative
            
            if (negative) {
                cy.get('[role="switch"][type="checkbox"]')
                .click({ force: true });
            }

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
        const editColumnByName = (oldName, newName, precision, defaultNumber, negative) => {
            // verify if column exists before delete
            cy.get(`th:contains(${oldName})`).should("exist");

            // delete opiton visible on mouse-over
            cy.get(`th:contains(${oldName}) .mdi-menu-down`)
                .trigger("mouseover")
                .click();

            // edit / save on pop-up
            cy.get(".nc-column-edit").click();
            cy.get(".nc-column-name-input input").clear().type(newName);

            // Configure Precision
            fetchParentFromLabel("Precision");
            cy.getActiveMenu().contains(precision).click();

            // Configure Default Number
            fetchParentFromLabel("Default Number (%)");
            cy.getActiveMenu().contains(defaultNumber).click();

            // Configure Negative
            cy.getActiveModal().find('[role="switch"][type="checkbox"]').invoke('val').then(($val) => {
                if ($val ^ negative) {
                    cy.getActiveModal()
                    .find('[role="switch"][type="checkbox"]')
                    .click({ force: true });
                }
            });

            cy.get(".nc-col-create-or-edit-card")
                .contains("Save")
                .click({ force: true });

            cy.toastWait("Percent column updated successfully");

            // validate if deleted (column shouldnt exist)
            cy.get(`th:contains(${oldName})`).should("not.exist");
            cy.get(`th:contains(${newName})`).should("exist");
        };

        const addPercentData = (colName, index, cellValue, expectedValue, isNewRow = false) => {
            if (isNewRow) {
                cy.get(".nc-add-new-row-btn:visible").should("exist");
                cy.wait(500)
                cy.get(".nc-add-new-row-btn").click({ force: true });
            } else {
                mainPage.getRow(index).find(".nc-row-expand-icon").click({ force: true });
            }
            cy.get(".percent-cell-wrapper > input").first().should('exist').type(cellValue);
            cy.getActiveModal().find("button").contains("Save row").click({ force: true });
            cy.toastWait("Row updated successfully");
            mainPage.getCell(colName, index).find('input').then(($e) => {
                expect($e[0].value).to.equal(expectedValue)
            })
        }

        ///////////////////////////////////////////////////
        // Test case
        {
            it("Percent: Create Columns", () => {
                // ( column name, precision, default value, negative )
                addPercentColumn("NC_PERCENT_0", '1', null, false);
                addPercentColumn("NC_PERCENT_1", '1.0', 1, true);
                addPercentColumn("NC_PERCENT_2", '1.00', 10, false);
                addPercentColumn("NC_PERCENT_3", '1.000', 100, true);
                addPercentColumn("NC_PERCENT_4", '1.0000', 1000, false);
                addPercentColumn("NC_PERCENT_5", '1.00000', 2, true);
                addPercentColumn("NC_PERCENT_6", '1.000000', 20, false);
                addPercentColumn("NC_PERCENT_7", '1.0000000', 200, true);
                addPercentColumn("NC_PERCENT_8", '1.00000000', 2000, false);
            });

            it("Percent: Test base case", () => {
                // ( colName, index, cellValue, expectedValue )
                addPercentData("NC_PERCENT_0", '1', 1, '1%');
                addPercentData("NC_PERCENT_1", '1', 1, '1.0%');
                addPercentData("NC_PERCENT_2", '1', 1, '1.00%');
                addPercentData("NC_PERCENT_3", '1', 1, '1.000%');
                addPercentData("NC_PERCENT_4", '1', 1, '1.0000%');
                addPercentData("NC_PERCENT_5", '1', 1, '1.00000%');
                addPercentData("NC_PERCENT_6", '1', 1, '1.000000%');
                addPercentData("NC_PERCENT_7", '1', 1, '1.0000000%');
                addPercentData("NC_PERCENT_8", '1', 1, '1.00000000%');
                addPercentData("NC_PERCENT_9", '1', 1, '1.000000000%');
            });

            it("Percent: Test default value", () => {
                // ( colName, index, cellValue, expectedValue )
                addPercentData("NC_PERCENT_0", '2', 1, '1%');
                addPercentData("NC_PERCENT_1", '2', null, '1.0%');
                addPercentData("NC_PERCENT_2", '2', null, '10.00%');
                addPercentData("NC_PERCENT_3", '2', null, '100.000%');
                addPercentData("NC_PERCENT_4", '2', null, '1000.0000%');
                addPercentData("NC_PERCENT_5", '2', null, '2.00000%');
                addPercentData("NC_PERCENT_6", '2', null, '20.000000%');
                addPercentData("NC_PERCENT_7", '2', null, '200.0000000%');
                addPercentData("NC_PERCENT_8", '2', null, '2000.00000000%');
            });


            it("Percent: Test percision", () => {
                // ( colName, index, cellValue, expectedValue )
                addPercentData("NC_PERCENT_0", '3', 1.123456789, '1%');
                addPercentData("NC_PERCENT_1", '3', 1.123456789, '1.1%');
                addPercentData("NC_PERCENT_2", '3', 1.123456789, '1.12%');
                addPercentData("NC_PERCENT_3", '3', 1.123456789, '1.123%');
                addPercentData("NC_PERCENT_4", '3', 1.123456789, '1.1235%');
                addPercentData("NC_PERCENT_5", '3', 1.123456789, '1.12346%');
                addPercentData("NC_PERCENT_6", '3', 1.123456789, '1.123457%');
                addPercentData("NC_PERCENT_7", '3', 1.123456789, '1.1234568%');
                addPercentData("NC_PERCENT_7", '3', 1.123456789, '1.12345679%');
            });


            it("Percent: Edit Columns", () => {
                // ( column name, new column name, precision, default value, negative )
                editColumnByName("NC_PERCENT_0", "NC_PERCENT_EDITED_0", '1.000000000', 300000, true);
                editColumnByName("NC_PERCENT_1", "NC_PERCENT_EDITED_1", '1.00000000', 2000, false);
                editColumnByName("NC_PERCENT_2", "NC_PERCENT_EDITED_2", '1.0000000', 200, true);
                editColumnByName("NC_PERCENT_3", "NC_PERCENT_EDITED_3", '1.000000', 20, false);
                editColumnByName("NC_PERCENT_4", "NC_PERCENT_EDITED_4", '1.00000', 2, true);
                editColumnByName("NC_PERCENT_5", "NC_PERCENT_EDITED_5", '1.0000', 2, false);
                editColumnByName("NC_PERCENT_6", "NC_PERCENT_EDITED_6", '1.000', 20, true);
                editColumnByName("NC_PERCENT_7", "NC_PERCENT_EDITED_7", '1.00', 200, false);
                editColumnByName("NC_PERCENT_8", "NC_PERCENT_EDITED_8", '1.0', 2000, true);
            });

            it("Percent: Delete Columns", () => {
                deleteColumnByName("NC_PERCENT_EDITED_0");
                deleteColumnByName("NC_PERCENT_EDITED_1");
                deleteColumnByName("NC_PERCENT_EDITED_2");
                deleteColumnByName("NC_PERCENT_EDITED_3");
                deleteColumnByName("NC_PERCENT_EDITED_4");
                deleteColumnByName("NC_PERCENT_EDITED_5");
                deleteColumnByName("NC_PERCENT_EDITED_6");
                deleteColumnByName("NC_PERCENT_EDITED_7");
                deleteColumnByName("NC_PERCENT_EDITED_8");
            });
        }
    });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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