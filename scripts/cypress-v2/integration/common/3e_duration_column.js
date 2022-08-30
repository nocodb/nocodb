import { mainPage } from "../../support/page_objects/mainPage";
import {
    isTestSuiteActive,
} from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - DURATION`, () => {
        const tableName = "DurationTable";

        // to retrieve few v-input nodes from their label
        //
        const fetchParentFromLabel = (label) => {
            cy.get("label").contains(label).parents(".ant-row").first().click();
            cy.wait(500)
        };

        // Run once before test- create table
        //
        before(() => {
            mainPage.tabReset();

            // // kludge: wait for page load to finish
            // cy.wait(1000);
            // // close team & auth tab
            // cy.get('button.ant-tabs-tab-remove').should('exist').click();
            // cy.wait(1000);

            cy.createTable(tableName);
        });

        beforeEach(() => {
        });

        after(() => {
            cy.deleteTable(tableName);
        });

        // Routine to create a new look up column
        //
        const addDurationColumn = (columnName, durationFormat) => {

            cy.get(".nc-grid  tr > th:last .nc-icon").click({
                force: true,
            });

            cy.getActiveMenu().find('input.nc-column-name-input', { timeout: 3000 })
              .should('exist')
              .clear()
              .type(columnName);
            cy.get(".nc-column-type-input").last().click().type("Duration");
            cy.getActiveSelection().find('.ant-select-item-option').contains("Duration").click();

            // Configure Duration format
            fetchParentFromLabel("Duration Format");
            cy.getActiveSelection().find('.ant-select-item-option').contains(durationFormat).click();

            cy.get(".ant-btn-primary").contains("Save").should('exist').click();
            cy.toastWait(`Column created`);

            cy.get(`th[data-title="${columnName}"]`).should("exist");
        };

        // routine to delete column
        //
        const deleteColumnByName = (columnName) => {
            mainPage.deleteColumn(columnName);
        };

        // routine to edit column
        //
        const editColumnByName = (oldName, newName, newDurationFormat) => {

            cy.get(`th:contains(${oldName}) .nc-icon.ant-dropdown-trigger`)
              .trigger("mouseover", { force: true })
              .click({ force: true });

            cy.get(".nc-column-edit").click();
            cy.wait(500)
            cy.get(".nc-column-edit").should("not.be.visible");

            // rename column and verify
            cy.getActiveMenu().find('input.nc-column-name-input', { timeout: 3000 })
              .should('exist')
              .clear()
              .type(newName);
            // Configure Duration format
            fetchParentFromLabel("Duration Format");
            cy.getActiveSelection().find('.ant-select-item-option').contains(newDurationFormat).click();

            cy.get(".ant-btn-primary:visible").contains("Save").click();

            cy.toastWait("Column updated");

            cy.get(`th:contains(${oldName})`).should("not.exist");
            cy.get(`th:contains(${newName})`).should("exist");
        };

        const addDurationData = (colName, index, cellValue, expectedValue, isNewRow = false) => {
            if (isNewRow) {
                cy.get(".nc-add-new-row-btn:visible").should("exist");
                cy.wait(500)
                cy.get(".nc-add-new-row-btn").click();
            } else {
                // mainPage.getRow(index).find(".nc-row-expand-icon").click({ force: true });
                cy.get(".nc-row-expand")
                    .eq(index-1)
                    .click({ force: true });
            }
            cy.get(".duration-cell-wrapper > input").first().should('exist').type(cellValue);
            cy.getActiveDrawer().find("button").contains("Save row").click({ force: true });
            cy.toastWait("Row updated successfully");
            cy.getActiveDrawer().find("button").contains("Cancel").click({ force: true });
            // mainPage.getCell(colName, index).find('input').then(($e) => {
            //     expect($e[0].value).to.equal(expectedValue)
            // })
            mainPage.getCell(colName, index)
                .contains(expectedValue)
                .should("exist");
        }

        ///////////////////////////////////////////////////
        // Test case
        {
            // Duration: h:mm
            it("Duration: h:mm", () => {
                addDurationColumn("NC_DURATION_0", "h:mm (e.g. 1:23)");
                addDurationData("NC_DURATION_0", 1, "1:30", "01:30", true);
                addDurationData("NC_DURATION_0", 2, "30", "00:30", true);
                addDurationData("NC_DURATION_0", 3, "60", "01:00", true);
                addDurationData("NC_DURATION_0", 4, "80", "01:20", true);
                addDurationData("NC_DURATION_0", 5, "12:34", "12:34", true);
                addDurationData("NC_DURATION_0", 6, "15:130", "17:10", true);
                addDurationData("NC_DURATION_0", 7, "123123", "2052:03", true);
            });

            it("Duration: Edit Column NC_DURATION_0", () => {
                editColumnByName(
                    "NC_DURATION_0",
                    "NC_DURATION_EDITED_0",
                    "h:mm:ss (e.g. 3:45, 1:23:40)"
                );
            });

            it("Duration: Delete column", () => {
                deleteColumnByName("NC_DURATION_EDITED_0");
            });
        }

        {
            // Duration: h:mm:ss
            it("Duration: h:mm:ss", () => {
                addDurationColumn("NC_DURATION_1", "h:mm:ss (e.g. 3:45, 1:23:40)");
                addDurationData("NC_DURATION_1", 1, "11:22:33", "11:22:33");
                addDurationData("NC_DURATION_1", 2, "1234", "00:20:34");
                addDurationData("NC_DURATION_1", 3, "50", "00:00:50");
                addDurationData("NC_DURATION_1", 4, "1:1111", "00:19:31");
                addDurationData("NC_DURATION_1", 5, "1:11:1111", "01:29:31");
                addDurationData("NC_DURATION_1", 6, "15:130", "00:17:10");
                addDurationData("NC_DURATION_1", 7, "123123", "34:12:03");
            });

            it("Duration: Edit Column NC_DURATION_1", () => {
                editColumnByName(
                    "NC_DURATION_1",
                    "NC_DURATION_EDITED_1",
                    "h:mm:ss.s (e.g. 3:34.6, 1:23:40.0)"
                );
            });

            it("Duration: Delete column", () => {
                deleteColumnByName("NC_DURATION_EDITED_1");
            });
        }

        {
            // h:mm:ss.s
            it("Duration: h:mm:ss.s", () => {
                addDurationColumn("NC_DURATION_2", "h:mm:ss.s (e.g. 3:34.6, 1:23:40.0)");
                addDurationData("NC_DURATION_2", 1, "1234", "00:20:34.0");
                addDurationData("NC_DURATION_2", 2, "12:34", "00:12:34.0");
                addDurationData("NC_DURATION_2", 3, "12:34:56", "12:34:56.0");
                addDurationData("NC_DURATION_2", 4, "12:34:999", "12:50:39.0");
                addDurationData("NC_DURATION_2", 5, "12:999:56", "28:39:56.0");
                addDurationData("NC_DURATION_2", 6, "12:34:56.12", "12:34:56.1");
                addDurationData("NC_DURATION_2", 7, "12:34:56.199", "12:34:56.2");
            });

            it("Duration: Edit Column NC_DURATION_2", () => {
                editColumnByName(
                    "NC_DURATION_2",
                    "NC_DURATION_EDITED_2",
                    "h:mm:ss (e.g. 3:45, 1:23:40)"
                );
            });

            it("Duration: Delete column", () => {
                deleteColumnByName("NC_DURATION_EDITED_2");
            });
        }

        {
            // h:mm:ss.ss
            it("Duration: h:mm:ss.ss", () => {
                addDurationColumn("NC_DURATION_3", "h:mm:ss.ss (e.g. 3.45.67, 1:23:40.00)");
                addDurationData("NC_DURATION_3", 1, "1234", "00:20:34.00");
                addDurationData("NC_DURATION_3", 2, "12:34", "00:12:34.00");
                addDurationData("NC_DURATION_3", 3, "12:34:56", "12:34:56.00");
                addDurationData("NC_DURATION_3", 4, "12:34:999", "12:50:39.00");
                addDurationData("NC_DURATION_3", 5, "12:999:56", "28:39:56.00");
                addDurationData("NC_DURATION_3", 6, "12:34:56.12", "12:34:56.12");
                addDurationData("NC_DURATION_3", 7, "12:34:56.199", "12:34:56.20");
            });

            it("Duration: Edit Column NC_DURATION_3", () => {
                editColumnByName(
                    "NC_DURATION_3",
                    "NC_DURATION_EDITED_3",
                    "h:mm:ss.ss (e.g. 3.45.67, 1:23:40.00)"
                );
            });

            it("Duration: Delete column", () => {
                deleteColumnByName("NC_DURATION_EDITED_3");
            });
        }

        {
            // h:mm:ss.sss
            it("Duration: h:mm:ss.sss", () => {
                addDurationColumn("NC_DURATION_4", "h:mm:ss.sss (e.g. 3.45.678, 1:23:40.000)");
                addDurationData("NC_DURATION_4", 1, "1234", "00:20:34.000");
                addDurationData("NC_DURATION_4", 2, "12:34", "00:12:34.000");
                addDurationData("NC_DURATION_4", 3, "12:34:56", "12:34:56.000");
                addDurationData("NC_DURATION_4", 4, "12:34:999", "12:50:39.000");
                addDurationData("NC_DURATION_4", 5, "12:999:56", "28:39:56.000");
                addDurationData("NC_DURATION_4", 6, "12:34:56.12", "12:34:56.012");
                addDurationData("NC_DURATION_4", 7, "12:34:56.199", "12:34:56.199");
            });

            it("Duration: Edit Column NC_DURATION_4", () => {
                editColumnByName(
                    "NC_DURATION_4",
                    "NC_DURATION_EDITED_4",
                    "h:mm (e.g. 1:23)"
                );
            });

            it("Duration: Delete column", () => {
                deleteColumnByName("NC_DURATION_EDITED_4");
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