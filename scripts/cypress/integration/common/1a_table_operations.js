import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage, settingsPage } from "../../support/page_objects/mainPage";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${
        dbType === "xcdb" ? "Meta - " : ""
    }${apiType.toUpperCase()} api - Table`, () => {
        before(() => {
            cy.fileHook();
            // cy.get(".mdi-close").click({ multiple: true });
        });

        beforeEach(() => {
            cy.fileHook();
        });

        after(() => {
            // cy.get(".mdi-close").click({ multiple: true, force: true });
        });

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

        it("Open Audit tab", () => {
            // mainPage.navigationDraw(mainPage.AUDIT).click();
            settingsPage.openMenu(settingsPage.AUDIT);
            // wait for column headers to appear
            //
            cy.get("thead > tr > th.ant-table-cell").should("have.length", 5);

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

            settingsPage.closeMenu()
        });

        it("Table Rename operation", () => {
            cy.get(".nc-project-tree-tbl-City").should("exist").click();

            cy.renameTable("City", "CityX");

            // verify
            // 1. Table name in project tree has changed
            // cy.get(".nc-tbl-title").contains("CityX").should("exist");
            cy.get(".nc-project-tree-tbl-CityX").should("exist");

            // 2. Table tab name has changed
            cy.get(`.ant-tabs-tab:contains('CityX'):visible`).should("exist");

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
