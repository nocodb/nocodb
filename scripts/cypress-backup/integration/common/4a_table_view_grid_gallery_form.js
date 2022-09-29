import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - Table views: Create/Edit/Delete`, () => {
        const name = "Test" + Date.now();

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

        // Common routine to create/edit/delete GRID & GALLERY view
        // Input: viewType - 'grid'/'gallery'
        //
        const viewTest = (viewType) => {
            it(`Create ${viewType} view`, () => {
                // click on 'Grid/Gallery' button on Views bar
                cy.get(`.nc-create-${viewType}-view`).click();

                // Pop up window, click Submit (accepting default name for view)
                cy.getActiveModal().find("button:contains(Submit)").click();
                cy.toastWait("View created successfully");

                // validate if view was creted && contains default name 'Country1'
                cy.get(`.nc-${viewType}-view-item`)
                    .contains("Country1")
                    .should("exist");

                cy.snip(`View_${viewType}`);
            });

            it(`Edit ${viewType} view name`, () => {
                // click on edit-icon (becomes visible on hovering mouse)
                cy.get(".nc-view-edit-icon").last().click({
                    force: true,
                    timeout: 1000,
                });

                // feed new name
                cy.get(`.nc-${viewType}-view-item input`).type(
                    `${viewType}View-1{enter}`
                );
                cy.toastWait("View renamed successfully");

                // validate
                cy.get(`.nc-${viewType}-view-item`)
                    .contains(`${viewType}View-1`)
                    .should("exist");
            });

            it(`Delete ${viewType} view`, () => {
                // number of view entries should be 2 before we delete
                cy.get(".nc-view-item").its("length").should("eq", 2);

                // click on delete icon (becomes visible on hovering mouse)
                cy.get(".nc-view-delete-icon").click({ force: true });
                cy.toastWait("View deleted successfully");

                // confirm if the number of veiw entries is reduced by 1
                cy.get(".nc-view-item").its("length").should("eq", 1);
            });
        };

        // below four scenario's will be invoked twice, once for rest & then for graphql
        viewTest("grid");
        viewTest("gallery");
        viewTest("form");
        // viewTest("kanban");
    });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Raju Udava <sivadstala@gmail.com>
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
